import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';

const TERMS_TEXT = `TÉRMINOS Y CONDICIONES DE USO
Bot DNI
Versión 2.0 — Última actualización: Mayo 2026

AVISO LEGAL IMPORTANTE: Al acceder, navegar o utilizar este sitio web de cualquier manera, el usuario acepta de forma expresa, voluntaria, informada e irrevocable la totalidad de los presentes Términos y Condiciones. Si el usuario no acepta estos términos, deberá abandonar el sitio de manera inmediata.

1. Identificación del Operador
El presente sitio web es operado y administrado por su creador (en adelante, "el Operador"), persona natural propietaria de la plataforma, quien actúa exclusivamente como proveedor técnico de acceso a información de carácter público o legalmente disponible en fuentes de terceros.

El Operador no es autor, editor, generador ni validador de los datos mostrados, y su función se limita estrictamente a facilitar el acceso técnico a información ya existente en fuentes externas de acceso público. En consecuencia, el Operador no ejerce control editorial sobre los datos presentados.

2. Naturaleza Informativa del Servicio
Este sitio web tiene carácter exclusivamente informativo y referencial. Los datos accesibles a través de este servicio provienen de fuentes de acceso público y son presentados sin modificación, validación ni garantía de ningún tipo por parte del Operador.

El servicio no constituye un servicio de investigación privada, verificación de antecedentes, inteligencia comercial ni ningún otro servicio regulado por la legislación peruana. Es responsabilidad exclusiva del usuario determinar si el uso que pretende dar a la información consultada está permitido por la ley.

3. Aceptación Expresa y Vinculante
El acceso y uso de este sitio web, en cualquiera de sus formas, implica la aceptación plena, expresa, libre e irrevocable de todos los términos aquí establecidos, constituyendo un acuerdo contractual vinculante entre el usuario y el Operador.

Esta aceptación:
- Tiene carácter irrenunciable y no puede ser revertida de forma retroactiva
- Se aplica a la totalidad del contenido del presente documento
- Obliga al usuario desde el primer momento de acceso al sitio
- Permanece vigente incluso después de dejar de utilizar el servicio

Si el usuario no acepta estos términos en su totalidad, deberá abstenerse de utilizar el servicio de manera inmediata.

4. Usos Permitidos del Servicio
El usuario se compromete de manera expresa a utilizar este sitio web únicamente para los siguientes fines legítimos y verificables:
- Consulta de información personal propia o de personas con las que tenga relación legal directa
- Verificación de identidad con propósitos legalmente justificados
- Investigación periodística o académica dentro del marco legal vigente en Perú
- Fines profesionales debidamente justificados y acreditables ante una autoridad competente
- Cualquier otro uso expresamente permitido por la Ley N.° 29733 y la normativa aplicable

5. Usos Estrictamente Prohibidos
Queda absolutamente prohibido, y será considerado una violación grave de estos términos, el uso del sitio o de la información obtenida en él para:
- Acoso, hostigamiento, persecución, vigilancia no consentida o stalking de terceros
- Amenazas, extorsión, chantaje o cualquier forma de coacción a personas
- Recopilación masiva, automatizada o sistemática de datos (scraping, bots, crawlers u otras técnicas)
- Actividades fraudulentas, estafas, suplantación de identidad o cualquier delito tipificado en la legislación peruana
- Discriminación, difamación, calumnia o cualquier ataque a la dignidad de las personas
- Comercialización no autorizada de datos obtenidos mediante el servicio
- Vigilancia política, religiosa, étnica o ideológica de individuos o grupos
- Violación de la privacidad, datos sensibles o intimidad de terceros en contravención a la Ley N.° 29733
- Cualquier actividad tipificada como delito informático bajo la Ley N.° 30096
- Cualquier finalidad que contravenga la Constitución Política del Perú, el Código Civil o el Código Penal peruano

La comisión de cualquiera de estos actos activa de manera inmediata la responsabilidad exclusiva, total e indelegable del usuario, eximiendo al Operador de toda consecuencia legal.

6. Exoneración Total e Irrevocable de Responsabilidad del Operador
El Operador queda expresa, total, plena e irrevocablemente exonerado de toda responsabilidad — sea de naturaleza civil, penal, administrativa, laboral, tributaria o de cualquier otra índole — que pudiera derivarse del uso que el usuario realice de la información consultada, accedida u obtenida a través de este sitio web.

Esta exoneración es absoluta y no admite excepciones, y comprende de manera específica pero no limitativa:
- Cualquier daño físico, psicológico, emocional, moral o económico causado a terceros
- Consecuencias derivadas del uso de datos para actividades ilícitas, fraudulentas o delictivas
- Perjuicios directos, indirectos, incidentales, especiales, consecuentes o punitivos de cualquier tipo
- Sanciones, multas, penalidades o condenas impuestas por autoridades judiciales, administrativas o regulatorias como resultado de las acciones del usuario
- Demandas judiciales, arbitrajes, mediaciones o procedimientos administrativos iniciados por terceros afectados por las acciones del usuario
- Pérdidas patrimoniales, lucro cesante o daño emergente de cualquier naturaleza
- Daños reputacionales, morales o de imagen causados a terceros por el uso indebido de la información
- Violaciones de derechos fundamentales de terceros perpetradas mediante el uso de información obtenida en el sitio

El Operador no tiene control sobre las acciones que los usuarios realizan con la información una vez obtenida, y bajo ninguna circunstancia ni argumento legal puede ser considerado responsable de las consecuencias de dichas acciones.

7. Responsabilidad Exclusiva, Personal e Integral del Usuario
El usuario asume, de forma plena, exclusiva, personal, indelegable e irrevocable, la totalidad de la responsabilidad legal por todas sus acciones, omisiones, decisiones y consecuencias que deriven directa o indirectamente del uso que realice de este sitio web y de la información obtenida en él.

Al aceptar estos términos, el usuario declara y reconoce expresamente que:
- Es el único y exclusivo responsable de cualquier uso — correcto o incorrecto, lícito o ilícito — que haga de los datos consultados
- Responderá personalmente y con la totalidad de su patrimonio ante cualquier autoridad judicial, administrativa o tercero que pudiera verse afectado por sus acciones
- Reconoce e informa que el Operador no tiene participación alguna en las consecuencias de sus actos posteriores a la consulta de información
- Se obliga a no intentar trasladar, atribuir, imputar ni compartir con el Operador ninguna responsabilidad derivada de sus propias acciones u omisiones
- Garantiza que cuenta con justificación legítima, legal y verificable para realizar las consultas que efectúe en el sitio
- Acepta ser el único imputado en cualquier acción legal, investigación fiscal, denuncia penal o reclamación civil que surja como consecuencia de su uso del servicio
- Reconoce haber actuado de forma autónoma, libre y voluntaria, sin ser inducido, dirigido ni controlado por el Operador en ningún momento

Esta declaración tiene valor de confesión expresa y admisión anticipada de responsabilidad, y podrá ser presentada como prueba documental en cualquier procedimiento legal en el que el Operador sea involucrado como consecuencia de las acciones del usuario.

8. Cláusula de Indemnidad, Defensa y Compensación del Operador
El usuario se compromete de manera expresa, irrevocable y exigible, a defender, indemnizar, compensar y mantener completamente indemne al Operador, así como a sus representantes legales, colaboradores y proveedores de servicios técnicos, frente a cualquier consecuencia derivada de las acciones del usuario.

9. Descargo de Responsabilidad sobre el Contenido (Disclaimer)
El Operador proporciona el servicio y la información "tal cual" (as is) y "según disponibilidad" (as available), sin garantías de ningún tipo, ya sean expresas o implícitas.

10. Exoneración por Uso de Información de Fuentes Externas
Toda la información accesible a través de este sitio proviene de fuentes de terceros y de acceso público, sobre las cuales el Operador no ejerce control editorial, legal ni técnico.

11. Privacidad, Protección de Datos y Responsabilidad del Usuario como Tratante
Este sitio reconoce y opera en conformidad con lo dispuesto en la Ley N.° 29733 – Ley de Protección de Datos Personales del Perú y su reglamento (D.S. N.° 003-2013-JUS).

El usuario, al consultar datos de terceras personas a través del servicio, se constituye automáticamente en responsable directo del tratamiento que realice con dicha información.

12. Ausencia de Relación de Agencia o Representación
Nada de lo dispuesto en estos Términos y Condiciones, ni el uso del servicio, crea una relación de agencia, representación, asociación, franquicia, contrato laboral ni ningún otro vínculo jurídico entre el usuario y el Operador.

13. Limitación de Acceso y Sanciones por Incumplimiento
El Operador se reserva el derecho unilateral de suspender o cancelar de manera inmediata el acceso de cualquier usuario que viole estos términos.

14. Propiedad Intelectual
El diseño, estructura, interfaz, código fuente, marca y contenido editorial de este sitio web son propiedad del Operador o de sus licenciantes.

15. Modificación de los Términos y Continuidad del Servicio
El Operador se reserva el derecho de modificar, actualizar o reemplazar estos Términos y Condiciones en cualquier momento.

16. Separabilidad de Cláusulas
Si alguna disposición de estos Términos y Condiciones fuera declarada inválida, dicha disposición se considerará separada del resto del documento.

17. Renuncia a Derechos
La omisión del Operador en ejercer cualquier derecho no constituirá una renuncia a dicho derecho.

18. Legislación Aplicable y Jurisdicción Exclusiva
Los presentes Términos y Condiciones se rigen por la legislación de la República del Perú. Cualquier controversia será sometida a la jurisdicción exclusiva de los Tribunales de Justicia de Trujillo, La Libertad, Perú.

19. Acuerdo Completo e Integración
Estos Términos y Condiciones constituyen el acuerdo completo entre el usuario y el Operador.

✅ DECLARACIÓN EXPRESA DE ACEPTACIÓN TOTAL
"Declaro libre y voluntariamente que he leído, comprendido y acepto en su totalidad e integridad los presentes Términos y Condiciones de Uso. Entiendo que soy el único y exclusivo responsable del uso que haga de la información consultada en este sitio web. Acepto que el Operador queda completa, plena e irrevocablemente eximido de cualquier responsabilidad civil, penal, administrativa o de cualquier otra naturaleza derivada de mis acciones, y que toda consecuencia de mis actos recae exclusiva e íntegramente sobre mi persona. Acepto además la jurisdicción exclusiva de los tribunales de Trujillo, Perú, para cualquier controversia derivada del uso del servicio."`;

export default function TermsModal() {
    const { isLoggedIn } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (isLoggedIn) {
            const hasAccepted = localStorage.getItem('terms_accepted');
            if (!hasAccepted) {
                const openTimer = setTimeout(() => setIsOpen(true), 0);
                return () => clearTimeout(openTimer);
            }
        }
    }, [isLoggedIn]);

    const handleAccept = () => {
        if (checked) {
            localStorage.setItem('terms_accepted', 'true');
            setAccepted(true);
            setTimeout(() => setIsOpen(false), 500);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlay={false} size="lg" panelClassName="flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0" aria-hidden="true">
                        <span className="material-icons-round text-xl sm:text-2xl">gavel</span>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">Términos y Condiciones</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Aceptación obligatoria</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                <div className="bg-slate-50 dark:bg-slate-950/30 p-5 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium shadow-inner break-words">
                    {TERMS_TEXT}
                </div>
            </div>

            {/* Footer */}
            <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                    <div className="relative flex items-center mt-0.5">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-all checked:bg-blue-600 checked:border-blue-600 focus:outline-none"
                        />
                        <span className="material-icons-round absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none text-base left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                            check
                        </span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                        He leído y acepto los Términos y Condiciones de Uso
                    </span>
                </label>

                <button
                    onClick={handleAccept}
                    disabled={!checked || accepted}
                    className={`
                        w-full min-h-[44px] py-4 rounded-2xl font-black text-sm sm:text-base uppercase tracking-widest transition-all shadow-xl
                        ${checked && !accepted
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 scale-[1.01] active:scale-[0.98]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'}
                    `}
                >
                    {accepted ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="material-icons-round animate-bounce" aria-hidden="true">check_circle</span>
                            ¡ACEPTADO!
                        </span>
                    ) : 'ACEPTAR Y CONTINUAR'}
                </button>
            </div>
        </Modal>
    );
}
