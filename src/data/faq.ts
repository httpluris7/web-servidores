/** Preguntas frecuentes reutilizables por las páginas de producto. */

export type FAQItem = { q: string; a: string };

export const vpsFaq: FAQItem[] = [
  {
    q: "¿Cuánto tarda en estar listo el VPS?",
    a: "El provisioning es automático: desde que se confirma el pago, tu servidor está online y accesible por SSH en menos de 60 segundos.",
  },
  {
    q: "¿La protección DDoS tiene coste extra?",
    a: "No. La mitigación está siempre activa en el borde de la red e incluida en todos los planes, sin límite por ataque ni cargos sorpresa.",
  },
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí. Puedes escalar de plan desde el panel sin migrar de host. El cambio se aplica en caliente y solo pagas la diferencia prorrateada.",
  },
  {
    q: "¿Qué sistemas operativos puedo instalar?",
    a: "Imágenes de Ubuntu, Debian, AlmaLinux, Rocky y Windows Server, además de plantillas con Docker preinstalado. También puedes subir tu propia ISO.",
  },
  {
    q: "¿El tráfico es realmente ilimitado?",
    a: "El tráfico no se factura por volumen. El uplink es de 10 Gbps compartido de forma justa; no hay overselling del puerto ni cortes por consumo.",
  },
  {
    q: "¿Hay permanencia?",
    a: "No. La facturación es mensual y puedes cancelar cuando quieras desde el panel. Sin cuotas de alta ni penalización por baja.",
  },
];

export const dedicatedFaq: FAQItem[] = [
  {
    q: "¿El ancho de banda es garantizado o compartido?",
    a: "El uplink indicado en cada plan es dedicado y garantizado a nivel de puerto. No hay overselling: la capacidad que contratas es la que tienes disponible en todo momento.",
  },
  {
    q: "¿Cuánto tarda la entrega de un dedicado?",
    a: "Los modelos en stock se entregan automatizados en pocos minutos. Configuraciones a medida pueden requerir hasta 24 horas; lo verás indicado al pedir.",
  },
  {
    q: "¿Incluye acceso IPMI/KVM?",
    a: "Sí. Todos los dedicados incluyen gestión remota fuera de banda (IPMI/KVM) para reinstalar, acceder a consola y diagnosticar sin depender de soporte.",
  },
  {
    q: "¿Puedo pedir una configuración personalizada?",
    a: "Sí. Discos, RAM, tarjetas de red de 25/100 Gbps o RAID a medida: contacta con el equipo comercial y preparamos una oferta.",
  },
  {
    q: "¿Qué RAID y discos soportáis?",
    a: "RAID por software y hardware sobre NVMe Gen4 y HDD de alta capacidad. Las configuraciones de storage admiten caché NVMe para acelerar lecturas.",
  },
  {
    q: "¿La protección DDoS también aplica al bare metal?",
    a: "Sí. La misma mitigación de hasta 25 Tbps protege VPS y dedicados por igual, sin coste adicional ni reconfiguración por tu parte.",
  },
];
