/*
 * sysPass
 *
 * @author nuxsmin
 * @link http://syspass.org
 * @copyright 2012-2017, Rubén Domínguez nuxsmin@$syspass.org
 *
 * This file is part of sysPass.
 *
 * sysPass is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * sysPass is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 *  along with sysPass.  If not, see <http://www.gnu.org/licenses/>.
 */

sysPass.Main = function () {
    "use strict";

    // Configuración de atributos generales
    var config = {
        APP_ROOT: "", // Base para llamadas AJAX
        LANG: [], // Array de lenguaje
        PK: "", // Clave pública
        MAX_FILE_SIZE: 1024, // Máximo tamaño de archivo
        CRYPT: new JSEncrypt(), // Inicializar la encriptación RSA
        CHECK_UPDATES: false, // Comprobar actualizaciones
        TIMEZONE: "",
        LOCALE: "",
        DEBUG: ""
    };

    // Variable para determinar si una clave de cuenta ha sido copiada al portapapeles
    var passToClip = 0;

    // Atributos del generador de claves
    var passwordData = {
        passLength: 0,
        minPasswordLength: 8,
        complexity: {
            chars: true,
            numbers: true,
            symbols: true,
            uppercase: true,
            numlength: 12
        }
    };

    // Objeto con las funciones propias del tema visual
    var appTheme = {};

    // Objeto con los triggers de la aplicación
    var appTriggers = {};

    // Objeto con las acciones de la aplicación
    var appActions = {};

    // Objeto con las funciones para peticiones de la aplicación
    var appRequests = {};

    // Objeto con las propiedades públicas
    var oPublic = {};

    // Objeto con las propiedades protegidas
    var oProtected = {};

    // Logging
    var log = {
        log: function (msg) {
            if (config.DEBUG === true) {
                console.log(msg);
            }
        },
        info: function (msg) {
            if (config.DEBUG === true) {
                console.info(msg);
            }
        },
        error: function (msg) {
            console.error(msg);
        },
        warn: function (msg) {
            console.warn(msg);
        },
        debug: function (msg) {
            if (config.DEBUG === true) {
                console.debug(msg);
            }
        }
    };

    // Opciones para Toastr
    toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": false,
        "progressBar": false,
        "positionClass": "toast-top-center",
        "preventDuplicates": false,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "5000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
    };

    /**
     * Retrollamadas de los elementos
     */
    var setupCallbacks = function () {
        log.info("setupCallbacks");

        var page = $("#container").data("page");

        if (page !== "" && typeof appTriggers.views[page] === "function") {
            appTriggers.views[page]();
        }

        if ($("footer").length > 0) {
            appTriggers.views.footer();
        }

        $("#btnBack").click(function () {
            redirect("index.php");
        });

        appTriggers.bodyHooks();
    };

    // Mostrar mensaje de aviso
    var msg = {
        ok: function (msg) {
            toastr.success(msg);
        },
        error: function (msg) {
            toastr.error(msg);
        },
        warn: function (msg) {
            toastr.warning(msg);
        },
        info: function (msg) {
            toastr.info(msg);
        },
        sticky: function (msg, callback) {
            var opts = {timeOut: 0};

            if (typeof callback === "function") {
                opts.onHidden = callback;
            }

            toastr.warning(msg, config.LANG[60], opts);
        },
        out: function (data) {
            if (typeof data === "object") {
                var status = data.status;
                var description = data.description;

                if (data.messages !== undefined && data.messages.length > 0) {
                    description = description + "<br>" + data.messages.join("<br>");
                }

                switch (status) {
                    case 0:
                        msg.ok(description);
                        break;
                    case 1:
                    case 2:
                    case 4:
                        msg.error(description);
                        break;
                    case 3:
                        msg.warn(description);
                        break;
                    case 10:
                        appActions.main.logout();
                        break;
                    case 100:
                        msg.ok(description);
                        msg.sticky(description);
                        break;
                    case 101:
                        msg.error(description);
                        msg.sticky(description);
                        break;
                    default:
                        msg.error(description);
                }
            }
        },
        html: {
            error: function (msg) {
                return "<p class=\"error round\">Oops...<br>" + config.LANG[1] + "<br>" + msg + "</p>";
            }
        }
    };

    /**
     * Inicialización
     */
    var init = function () {
        log.info("init");

        oPublic = getPublic();
        oProtected = getProtected();

        appTriggers = sysPass.Triggers(oProtected);
        appActions = sysPass.Actions(oProtected);
        appRequests = sysPass.Requests(oProtected);

        getEnvironment(function () {
            if (config.PK !== "") {
                bindPassEncrypt();
            }

            if (typeof sysPass.Theme === "function") {
                appTheme = sysPass.Theme(oProtected);
            }

            if (config.CHECK_UPDATES === true) {
                appActions.main.getUpdates();
            }

            initializeClipboard();
            setupCallbacks();
            checkLogout();
        });
    };

    /**
     * Obtener las variables de entorno de sysPass
     */
    var getEnvironment = function (callback) {
        log.info("getEnvironment");

        var path = window.location.pathname.split("/");
        var rootPath = function () {
            var fullPath = "";

            for (var i = 1; i <= path.length - 2; i++) {
                fullPath += "/" + path[i];
            }

            return fullPath;
        };

        config.APP_ROOT = window.location.protocol + "//" + window.location.host + rootPath();

        var opts = appRequests.getRequestOpts();
        opts.url = "/ajax/ajax_getEnvironment.php";
        opts.method = "get";
        opts.async = false;
        opts.useLoading = false;
        opts.data = {isAjax: 1};

        appRequests.getActionCall(opts, function (json) {
            // config.APP_ROOT = json.app_root;
            config.LANG = json.lang;
            config.PK = json.pk;
            config.CHECK_UPDATES = json.check_updates;
            config.CRYPT.setPublicKey(json.pk);
            config.TIMEZONE = json.timezone;
            config.LOCALE = json.locale;
            config.DEBUG = json.debug;
            config.MAX_FILE_SIZE = parseInt(json.max_file_size);

            if (typeof callback === "function") {
                callback();
            }
        });
    };

    // Objeto para leer/escribir el token de seguridad
    var sk = {
        get: function () {
            log.info("sk:get");
            return $("#container").attr("data-sk");
        },
        set: function (sk) {
            log.info("sk:set");
            $("#container").attr("data-sk", sk);
        }
    };

    // Función para establecer la altura del contenedor ajax
    var setContentSize = function () {
        var $container = $("#container");

        if ($container.hasClass("content-no-auto-resize")) {
            return;
        }

        //console.info($("#content").height());

        // Calculate total height for full body resize
        var totalHeight = $("#content").height() + 200;
        //var totalWidth = $("#wrap").width();

        $container.css("height", totalHeight);
    };

    // Función para retornar el scroll a la posición inicial
    var scrollUp = function () {
        $("html, body").animate({scrollTop: 0}, "slow");
    };


    // Función para obtener las variables de la URL y parsearlas a un array.
    var getUrlVars = function (param) {
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
        for (var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split("=");
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }

        return param !== undefined && vars[param] !== undefined ? vars[param] : vars;
    };

    // Función para comprobar si se ha salido de la sesión
    var checkLogout = function () {
        log.info("checkLogout");

        if (parseInt(getUrlVars("logout")) === 1) {
            msg.sticky(config.LANG[61], function () {
                redirect("index.php");
            });
        }
    };

    var redirect = function (url) {
        window.location.replace(url);
    };

    // Función para habilitar la subida de archivos en una zona o formulario
    var fileUpload = function ($obj) {
        var requestData = {
            actionId: $obj.data("action-id"),
            itemId: $obj.data("item-id"),
            sk: sk.get()
        };

        var options = {
            requestDoneAction: "",
            setRequestData: function (data) {
                $.extend(requestData, data);
            },
            getRequestData: function () {
                return requestData;
            },
            beforeSendAction: "",
            url: ""
        };

        // Subir un archivo
        var sendFile = function (file) {
            if (options.url === undefined || options.url === "") {
                return false;
            }

            // Objeto FormData para crear datos de un formulario
            var fd = new FormData();
            fd.append("inFile", file);
            fd.append("isAjax", 1);

            requestData.sk = sk.get();

            Object.keys(requestData).forEach(function (key) {
                fd.append(key, requestData[key]);
            });

            var opts = appRequests.getRequestOpts();
            opts.url = options.url;
            opts.processData = false;
            opts.contentType = false;
            opts.data = fd;

            appRequests.getActionCall(opts, function (json) {
                var status = json.status;
                var description = json.description;

                if (status === 0) {
                    if (typeof options.requestDoneAction === "function") {
                        options.requestDoneAction();
                    }

                    msg.ok(description);
                } else if (status === 10) {
                    appActions.main.logout();
                } else {
                    msg.error(description);
                }
            });

        };

        var checkFileSize = function (size) {
            return (size / 1000 > config.MAX_FILE_SIZE);
        };

        var checkFileExtension = function (name) {
            var file_exts_ok = $obj.data("files-ext").toLowerCase().split(",");

            for (var i = 0; i <= file_exts_ok.length; i++) {
                if (name.indexOf(file_exts_ok[i]) !== -1) {
                    return true;
                }
            }

            return false;
        };

        // Comprobar los archivos y subirlos
        var handleFiles = function (filesArray) {
            if (filesArray.length > 5) {
                msg.error(config.LANG[17] + " (Max: 5)");
                return;
            }

            for (var i = 0; i < filesArray.length; i++) {
                var file = filesArray[i];
                if (checkFileSize(file.size)) {
                    msg.error(config.LANG[18] + "<br>" + file.name + " (Max: " + config.MAX_FILE_SIZE + ")");
                } else if (!checkFileExtension(file.name)) {
                    msg.error(config.LANG[19] + "<br>" + file.name);
                } else {
                    sendFile(filesArray[i]);
                }
            }
        };

        // Inicializar la zona de subida de archivos Drag&Drop
        var init = function () {
            log.info("fileUpload:init");

            var fallback = initForm(false);

            $obj.on("dragover dragenter", function (e) {
                log.info("fileUpload:drag");

                e.stopPropagation();
                e.preventDefault();
            });

            $obj.on("drop", function (e) {
                log.info("fileUpload:drop");

                e.stopPropagation();
                e.preventDefault();

                if (typeof options.beforeSendAction === "function") {
                    options.beforeSendAction();
                }

                handleFiles(e.originalEvent.dataTransfer.files);
            });

            $obj.on("click", function () {
                fallback.click();
            });
        };

        // Inicializar el formulario de archivos en modo compatibilidad
        var initForm = function (display) {
            var $form = $("#fileUploadForm");

            if (display === false) {
                $form.hide();
            }

            var $input = $form.find("input[type='file']");

            $input.on("change", function () {
                if (typeof options.beforeSendAction === "function") {
                    options.beforeSendAction();
                }

                handleFiles(this.files);
            });

            return $input;
        };


        if (window.File && window.FileList && window.FileReader) {
            init();
        } else {
            initForm(true);
        }

        return options;
    };

    // Función para obtener el tiempo actual en milisegundos
    var getTime = function () {
        var t = new Date();
        return t.getTime();
    };

    // Funciones para analizar al fortaleza de una clave
    // From http://net.tutsplus.com/tutorials/javascript-ajax/build-a-simple-password-strength-checker/
    var checkPassLevel = function ($target) {
        log.info("checkPassLevel");

        passwordData.passLength = $target.val().length;

        outputResult(zxcvbn($target.val()), $target);
    };

    var outputResult = function (level, $target) {
        log.info("outputResult");

        var $passLevel = $(".passLevel-" + $target.attr("id"));
        var score = level.score;

        $passLevel.show();
        $passLevel.removeClass("weak good strong strongest");

        if (passwordData.passLength === 0) {
            $passLevel.attr("title", "").empty();
        } else if (passwordData.passLength < passwordData.minPasswordLength) {
            $passLevel.attr("title", config.LANG[11]).addClass("weak");
        } else if (score === 0) {
            $passLevel.attr("title", config.LANG[9] + " - " + level.feedback.warning).addClass("weak");
        } else if (score === 1 || score === 2) {
            $passLevel.attr("title", config.LANG[8] + " - " + level.feedback.warning).addClass("good");
        } else if (score === 3) {
            $passLevel.attr("title", config.LANG[7]).addClass("strong");
        } else if (score === 4) {
            $passLevel.attr("title", config.LANG[10]).addClass("strongest");
        }
    };

    /**
     * Detectar los imputs del tipo checkbox para generar botones
     *
     * @param container El contenedor donde buscar
     */
    var checkboxDetect = function (container) {
        $(container).find(".checkbox").button({
            icons: {primary: "ui-icon-transferthick-e-w"}
        }).click(
            function () {
                var $this = $(this);

                if ($this.prop("checked") === true) {
                    $this.button("option", "label", config.LANG[40]);
                } else {
                    $this.button("option", "label", config.LANG[41]);
                }
            }
        );
    };

    /**
     * Encriptar el valor de un campo del formulario
     *
     * @param $input El id del campo
     */
    var encryptFormValue = function ($input) {
        log.info("encryptFormValue");

        var curValue = $input.val();

        if (curValue !== "" && parseInt($input.attr("data-length")) !== curValue.length) {
            var passEncrypted = config.CRYPT.encrypt(curValue);

            $input.val(passEncrypted);
            $input.attr("data-length", passEncrypted.length);
        }
    };

    var initializeClipboard = function () {
        log.info("initializeClipboard");

        var clipboard = new Clipboard(".clip-pass-button", {
            text: function (trigger) {
                var pass = appActions.account.copypass($(trigger));

                return pass.responseJSON.data.accpass;
            }
        });

        clipboard.on("success", function (e) {
            msg.ok(config.LANG[45]);
        });

        clipboard.on("error", function (e) {
            msg.error(config.LANG[46]);
        });

        // Portapapeles para claves visualizadas

        // Inicializar el objeto para copiar al portapapeles
        var clipboardPass = new Clipboard(".dialog-clip-pass-button");
        var clipboardUser = new Clipboard(".dialog-clip-user-button");

        clipboardPass.on("success", function (e) {
            $(".dialog-user-text").removeClass("dialog-clip-copy");
            $(".dialog-pass-text").addClass("dialog-clip-copy");
            e.clearSelection();
        });

        clipboardUser.on("success", function (e) {
            $(".dialog-pass-text").removeClass("dialog-clip-copy");
            $(".dialog-user-text").addClass("dialog-clip-copy");
            e.clearSelection();
        });

        var clipboardIcon = new Clipboard(".clip-pass-icon");

        clipboardIcon.on("success", function (e) {
            msg.ok(config.LANG[45]);
            e.clearSelection();
        });
    };

    /**
     * Delegar los eventos 'blur' y 'keypress' para que los campos de claves
     * sean encriptados antes de ser enviados por el formulario
     */
    var bindPassEncrypt = function () {
        log.info("bindPassEncrypt");

        $("body").on("blur", ":input[type=password]", function (e) {
            var $this = $(this);

            if ($this.hasClass("passwordfield__no-pki")) {
                return;
            }

            encryptFormValue($this);
        }).on("keypress", ":input[type=password]", function (e) {
            if (e.keyCode === 13) {
                e.preventDefault();

                var $this = $(this);
                encryptFormValue($this);

                var $form = $this.closest("form");
                $form.submit();
            }
        });
    };

    /**
     * Evaluar una acción javascript y ejecutar la función
     *
     * @param evalFn
     * @param $obj
     */
    var evalAction = function (evalFn, $obj) {
        console.info("Eval: " + evalFn);

        if (typeof evalFn === "function") {
            evalFn($obj);
        } else {
            throw Error("Function not found: " + evalFn);
        }
    };

    /**
     * Redimensionar una imagen al viewport
     *
     * @param $obj
     */
    var resizeImage = function ($obj) {
        log.info("resizeImage");

        var viewport = {
            width: $(window).width() * 0.90,
            height: $(window).height() * 0.90
        };
        var image = {
            width: $obj.width(),
            height: $obj.height()
        };
        var dimension = {
            calc: 0,
            main: 0,
            secondary: 0,
            factor: 0.90,
            rel: image.width / image.height
        };

        /**
         * Ajustar la relación de aspecto de la imagen.
         *
         * Se tiene en cuenta la dimensión máxima en el eje opuesto.
         *
         * @param dimension
         * @returns {*}
         */
        var adjustRel = function (dimension) {
            if (dimension.main > dimension.secondary) {
                dimension.calc = dimension.main / dimension.rel;
            } else if (dimension.main < dimension.secondary) {
                dimension.calc = dimension.main * dimension.rel;
            }

            if (dimension.calc > dimension.secondary) {
                dimension.main *= dimension.factor;

                adjustRel(dimension);
            }

            return dimension;
        };

        /**
         * Redimensionar en relación a la anchura
         */
        var resizeWidth = function () {
            dimension.main = viewport.width;
            dimension.secondary = viewport.height;

            var adjust = adjustRel(dimension);

            $obj.css({
                "width": adjust.main,
                "height": adjust.calc
            });

            image.width = adjust.main;
            image.height = adjust.calc;
        };

        /**
         * Redimensionar en relación a la altura
         */
        var resizeHeight = function () {
            dimension.main = viewport.height;
            dimension.secondary = viewport.width;

            var adjust = adjustRel(dimension);

            $obj.css({
                "width": adjust.calc,
                "height": adjust.main
            });

            image.width = adjust.calc;
            image.height = adjust.main;
        };

        if (image.width > viewport.width) {
            resizeWidth();
        } else if (image.height > viewport.height) {
            log.info("height");
            resizeHeight();
        }

        return image;
    };

    // Objeto con métodos y propiedades protegidas
    var getProtected = function () {
        return $.extend({
            log: log,
            config: function () {
                return config;
            },
            appTheme: function () {
                return appTheme;
            },
            appActions: function () {
                return appActions;
            },
            appTriggers: function () {
                return appTriggers;
            },
            appRequests: function () {
                return appRequests;
            },
            evalAction: evalAction,
            resizeImage: resizeImage
        }, oPublic);
    };

    // Objeto con métodos y propiedades públicas
    var getPublic = function () {
        return {
            actions: function () {
                return appActions;
            },
            triggers: function () {
                return appTriggers;
            },
            theme: function () {
                return appTheme;
            },
            sk: sk,
            msg: msg,
            log: log,
            passToClip: passToClip,
            passwordData: passwordData,
            outputResult: outputResult,
            checkboxDetect: checkboxDetect,
            checkPassLevel: checkPassLevel,
            encryptFormValue: encryptFormValue,
            fileUpload: fileUpload,
            redirect: redirect,
            scrollUp: scrollUp,
            setContentSize: setContentSize
        };
    };

    init();

    return oPublic;
};