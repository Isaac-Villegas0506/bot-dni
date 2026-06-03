// Tabla central de z-index. Cualquier capa con apilamiento usa estas constantes
// para evitar competencia (sidebar tapa modal, modal tapa toast, etc.).
//
// Orden ascendente = más arriba en pantalla.
export const Z_INDEX = {
    base:            0,
    sticky:          30,   // bottom nav admin, tab bars
    header:          50,   // sticky header
    sidebarBackdrop: 60,   // overlay tras sidebar
    sidebar:         70,   // drawer
    modal:           100,  // modales principales (auth, search options, alerts)
    modalAbove:      200,  // modales nested o que aparecen sobre otro modal
    toast:           1000,
};
