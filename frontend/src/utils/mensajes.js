/**
 * Mensajes de error en lenguaje llano.
 *
 * Regla de redacción (cada mensaje tiene que responder tres cosas):
 *   1. Qué pasó      -> sin jerga técnica ni códigos HTTP
 *   2. Por qué       -> el motivo real, cuando se conoce
 *   3. Qué hacer     -> la acción concreta que el usuario puede tomar
 *
 * Nunca se muestra al usuario un mensaje del backend tal cual: los proveedores
 * devuelven volcados con **, emojis y a veces datos de otra persona.
 */

/** Errores de red y tiempo de espera (los más comunes). */
export const ERRORES_RED = {
    timeout:
        'La consulta está tardando más de lo normal. ' +
        'El proveedor de datos puede estar saturado. Vuelve a intentarlo en un momento.',
    sinConexion:
        'No pudimos conectar con el servidor. ' +
        'Revisa tu conexión a internet y vuelve a intentarlo.',
    cancelado: 'Cancelaste la consulta.',
    generico:
        'Algo salió mal y no pudimos completar la consulta. ' +
        'Vuelve a intentarlo; si sigue pasando, espera unos minutos.',
};

/** Errores por tipo de consulta. */
export const ERRORES_CONSULTA = {
    dniSinDatos: (dni) =>
        `No encontramos información para el DNI ${dni}. ` +
        'Revisa que los 8 dígitos estén bien escritos y vuelve a intentarlo.',

    dniIncompleto:
        'El DNI debe tener exactamente 8 números. ' +
        'Escríbelo de nuevo sin espacios ni guiones.',

    nombreSinDatos:
        'No encontramos a nadie con ese nombre. ' +
        'Prueba escribiendo solo el nombre y el apellido paterno, ' +
        'o revisa si está bien escrito.',

    nombreInvalido:
        'Ese texto no parece un nombre. ' +
        'Escribe el nombre completo con letras, por ejemplo: JUAN PEREZ GARCIA.',

    nombreVacio:
        'Escribe al menos un nombre para poder buscar.',

    captchaVencido:
        'La verificación de seguridad caducó mientras escribías. ' +
        'Vuelve a intentarlo y complétala de nuevo.',

    sinCreditos: (tienes = 0, necesitas = 1) =>
        `Esta consulta cuesta ${necesitas} crédito${necesitas === 1 ? '' : 's'} ` +
        `y tienes ${tienes}. ` +
        'Puedes ganar créditos gratis o comprarlos en la tienda.',

    demasiadasConsultas:
        'Hiciste varias consultas muy seguidas. ' +
        'Espera unos segundos y vuelve a intentarlo.',

    servicioPausado:
        'Esta función está desactivada por el momento. ' +
        'Estamos trabajando en ello; prueba más tarde.',

    mantenimiento:
        'El servicio está en mantenimiento. ' +
        'Volverá a estar disponible en unos minutos.',

    requiereSesion:
        'Necesitas iniciar sesión para usar esta función. ' +
        'Entra con tu cuenta de Google y vuelve a intentarlo.',

    sinPermisos:
        'Tu cuenta no tiene acceso a esta función. ' +
        'Si crees que es un error, escríbenos.',

    archivoNoDisponible:
        'No pudimos preparar el archivo. ' +
        'Vuelve a generar la consulta e inténtalo otra vez.',

    archivoVacio:
        'El archivo llegó vacío. ' +
        'Vuelve a generar la consulta.',

    // ── Otros apartados ────────────────────────────────────────────────────
    telefonoSinDatos: (num) =>
        `No encontramos información para el número ${num}. ` +
        'Revisa que tenga 9 dígitos y que sea un celular peruano.',

    telefonoInvalido:
        'El número debe tener 9 dígitos y empezar por 9. ' +
        'Escríbelo de nuevo sin espacios ni guiones.',

    placaSinDatos: (placa) =>
        `No encontramos información para la placa ${placa}. ` +
        'Verifica que esté bien escrita (6 caracteres, sin guiones).',

    placaInvalida:
        'La placa debe tener 6 caracteres. ' +
        'Escríbela sin espacios ni guiones, por ejemplo: ABC123.',

    dniSinDatosOtro:
        'No encontramos resultados para ese DNI. ' +
        'Verifica que los 8 dígitos estén bien escritos.',

    rucInvalido:
        'El RUC debe tener 11 dígitos. ' +
        'Escríbelo de nuevo sin espacios ni guiones.',

    imagenInvalida:
        'Ese archivo no es una imagen válida. ' +
        'Sube una foto en formato JPG o PNG.',

    imagenFaltante:
        'No adjuntaste ninguna foto. ' +
        'Selecciona una imagen de tu dispositivo y vuelve a intentarlo.',

    rostroNoReconocido:
        'No pudimos reconocer un rostro en la foto. ' +
        'Usa una imagen clara, de frente y con buena luz.',

    campoFaltante: (campo) =>
        `Falta completar ${campo}. ` +
        'Rellena ese dato y vuelve a intentarlo.',
};

/** Errores de cuenta y acceso. */
export const ERRORES_CUENTA = {
    credencialesMal:
        'El correo o la contraseña no coinciden. ' +
        'Revísalos y vuelve a intentarlo.',

    correoNoRegistrado:
        'No encontramos una cuenta con ese correo. ' +
        'Verifica que esté bien escrito o crea una cuenta nueva.',

    correoYaRegistrado:
        'Ya existe una cuenta con ese correo. ' +
        'Inicia sesión en lugar de registrarte.',

    correoInvalido:
        'Ese correo no parece válido. ' +
        'Escríbelo completo, por ejemplo: nombre@gmail.com.',

    contrasenaCorta:
        'La contraseña es demasiado corta. ' +
        'Usa al menos 6 caracteres.',

    googleFalló:
        'No pudimos conectar con Google. ' +
        'Cierra la ventana e inténtalo de nuevo.',

    correoNoEnviado:
        'No pudimos enviar el correo. ' +
        'Revisa que la dirección esté bien escrita e inténtalo otra vez.',

    cuentaBaneada:
        'Esta cuenta está suspendida. ' +
        'Escríbenos si crees que se trata de un error.',
};

/**
 * Convierte un error de fetch/excepción en un mensaje para el usuario.
 *
 * Sustituye a getQueryErrorMessage: distingue timeout, falta de red,
 * cancelación y error desconocido, y en ningún caso devuelve el mensaje
 * técnico original.
 */
export function mensajeDeExcepcion(e) {
    if (e?.name === 'TimeoutError') return ERRORES_RED.timeout;
    if (e?.name === 'AbortError') return ERRORES_RED.cancelado;
    // TypeError de fetch = fallo de red (DNS, sin internet, CORS)
    if (e instanceof TypeError) return ERRORES_RED.sinConexion;
    return ERRORES_RED.generico;
}

/**
 * Resuelve cualquier error de una consulta a { type, title, message }.
 *
 * Es el punto único que deben usar los componentes de consulta: acepta tanto
 * una excepción de red como la respuesta de un endpoint con error, así que
 * sustituye al uso directo de `getQueryErrorMessage(error)` + `type: 'error'`
 * (que mostraba "Error en la consulta" para todo y dejaba el mensaje vacío
 * cuando el error venía del backend).
 *
 * @param {Error|{status:number, detail?:string}} error
 * @param {'dni'|'name'|'telefono'|'placa'|'generico'} contexto
 * @param {string} [valor] DNI, teléfono o placa consultada (para personalizar).
 */
export function mensajeDeError(error, contexto = 'generico', valor = '') {
    // Respuesta HTTP ya inspeccionada por el componente
    if (error && typeof error.status === 'number') {
        return mensajeDeRespuesta(error.status, error.detail, contexto, valor);
    }
    // Excepción lanzada con un mensaje ya redactado por el backend
    const detalle = typeof error?.message === 'string' ? error.message : '';
    if (detalle) {
        const { type, title } = mensajeDeRespuesta(
            /cr[eé]dito/i.test(detalle) ? 402 : 0,
            detalle,
            contexto,
            valor,
        );
        // Si el mensaje del backend es legible se respeta; si no, catálogo.
        const legible =
            detalle.length > 12 &&
            detalle.length < 180 &&
            !/[*`➮➾➟➡]|tg:\/\//.test(detalle) &&
            detalle !== detalle.toUpperCase();
        return {
            type,
            title,
            message: legible ? detalle : mensajeDeExcepcion(error),
        };
    }
    return {
        type: 'error',
        title: 'No se pudo completar la consulta',
        message: mensajeDeExcepcion(error),
    };
}

/**
 * Elige el texto de "sin resultados" según lo que se consultó.
 *
 * Cada apartado busca cosas distintas (DNI, nombre, teléfono, placa), así que
 * decir siempre "para ese DNI" confundía en búsquedas de teléfono o vehículos.
 */
function SIN_DATOS_POR_CONTEXTO(contexto, valor) {
    const v = valor || '';
    switch (contexto) {
        case 'name':
            return ERRORES_CONSULTA.nombreSinDatos;
        case 'telefono':
            return ERRORES_CONSULTA.telefonoSinDatos(v || 'consultado');
        case 'placa':
            return ERRORES_CONSULTA.placaSinDatos(v || 'consultada');
        case 'dni':
            return ERRORES_CONSULTA.dniSinDatos(v || 'consultado');
        default:
            return ERRORES_CONSULTA.dniSinDatosOtro;
    }
}

/**
 * Traduce un status HTTP + detalle del backend al mensaje del catálogo.
 *
 * @param {number} status       Código HTTP de la respuesta.
 * @param {string} detail       `detail` del backend (puede venir sucio).
 * @param {'dni'|'name'} contexto Tipo de búsqueda.
 * @param {string} [valor]      El DNI consultado, para personalizar el mensaje.
 *
 * Devuelve { type, title, message } listo para AlertModal. El `detail` del
 * backend solo se usa si ya viene redactado para el usuario: descartamos los
 * volcados del proveedor (markdown, emojis) y los mensajes en mayúsculas del
 * bot como "POR FAVOR ESPERA".
 */
export function mensajeDeRespuesta(status, detail, contexto = 'dni', valor = '') {
    const limpio = typeof detail === 'string' ? detail.trim() : '';
    // Un volcado del bot trae markdown, emojis o enlaces; no se muestra.
    // Tampoco los avisos en mayúsculas del proveedor ("POR FAVOR ESPERA").
    const esLegible =
        limpio.length > 12 &&
        limpio.length < 180 &&
        !/[*`➮➾➟➡]|tg:\/\//.test(limpio) &&
        limpio !== limpio.toUpperCase();

    switch (status) {
        case 400:
            return {
                type: 'warning',
                title: 'Revisa los datos',
                message: esLegible
                    ? limpio
                    : contexto === 'name'
                        ? ERRORES_CONSULTA.nombreInvalido
                        : ERRORES_CONSULTA.dniIncompleto,
            };
        case 401:
            return {
                type: 'warning',
                title: 'Inicia sesión',
                message: ERRORES_CONSULTA.requiereSesion,
            };
        case 402:
        case 403: {
            // 403 se usa tanto para captcha como para créditos y permisos.
            if (/captcha|turnstile|verificaci/i.test(limpio)) {
                return {
                    type: 'warning',
                    title: 'Verificación caducada',
                    message: ERRORES_CONSULTA.captchaVencido,
                };
            }
            if (status === 402 || /cr[eé]dito/i.test(limpio)) {
                return {
                    type: 'insufficient_credits',
                    title: null,
                    message: ERRORES_CONSULTA.sinCreditos(),
                };
            }
            return {
                type: 'warning',
                title: 'Sin acceso',
                message: esLegible ? limpio : ERRORES_CONSULTA.sinPermisos,
            };
        }
        case 404:
            return {
                type: 'warning',
                title: 'Sin resultados',
                message: SIN_DATOS_POR_CONTEXTO(contexto, valor),
            };
        case 429:
            return {
                type: 'warning',
                title: 'Espera un momento',
                message: ERRORES_CONSULTA.demasiadasConsultas,
            };
        case 503:
            return {
                type: 'warning',
                title: 'Función pausada',
                message: /mantenimiento/i.test(limpio)
                    ? ERRORES_CONSULTA.mantenimiento
                    : ERRORES_CONSULTA.servicioPausado,
            };
        case 500:
        case 502:
        case 504:
            return {
                type: 'error',
                title: 'Problema en el servidor',
                message: ERRORES_RED.generico,
            };
        default:
            return {
                type: 'error',
                title: 'No se pudo completar la consulta',
                message: ERRORES_RED.generico,
            };
    }
}
