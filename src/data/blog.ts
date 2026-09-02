/**
 * Blog de ViaHost. El contenido vive aquí (no hay CMS): cada post trae su texto
 * por idioma y sus metadatos. Las páginas `/blog` y `/blog/[slug]` lo leen y
 * generan Article/HowTo + FAQPage + BreadcrumbList. Añadir un post = un objeto.
 */

export type BlogLocale = "es" | "en" | "fr";

export type BlogSection = { heading: string; body: string[] };
export type BlogFaq = { q: string; a: string };

export type BlogContent = {
  title: string;
  description: string;
  intro: string[];
  /** En posts `howto`, cada sección es un paso (HowToStep). */
  sections: BlogSection[];
  faq?: BlogFaq[];
  cta: string;
};

export type BlogPost = {
  slug: string;
  /** ISO (fecha de publicación). */
  date: string;
  type: "article" | "howto";
  /** Producto al que enlaza el CTA. */
  ctaHref: string;
  content: Record<BlogLocale, BlogContent>;
};

export const posts: BlogPost[] = [
  {
    slug: "vps-vs-hosting-compartido",
    date: "2026-08-20",
    type: "article",
    ctaHref: "/vps",
    content: {
      es: {
        title: "VPS vs hosting compartido: cuál elegir",
        description:
          "Diferencias entre un VPS y un hosting compartido y cómo elegir según tu proyecto: control, recursos, rendimiento y precio.",
        intro: [
          "El hosting compartido y el VPS resuelven necesidades distintas. La forma rápida de decidir: si quieres publicar una web con el mínimo mantenimiento, hosting compartido; si necesitas control total del servidor y recursos dedicados, un VPS.",
        ],
        sections: [
          {
            heading: "Qué es el hosting compartido",
            body: [
              "En el hosting compartido tu web convive con otras en el mismo servidor y lo gestionas todo desde un panel como cPanel. No administras el sistema operativo: instalas WordPress, subes tu web y te olvidas del mantenimiento.",
              "Es la opción más sencilla y económica para webs, blogs y tiendas pequeñas o medianas.",
            ],
          },
          {
            heading: "Qué es un VPS",
            body: [
              "Un VPS (servidor virtual privado) te da una máquina con recursos dedicados (vCPU, RAM y disco NVMe) y acceso root: instalas lo que quieras y controlas el sistema de arriba a abajo.",
              "A cambio de esa potencia y libertad, tú te encargas de la administración (o usas un panel encima).",
            ],
          },
          {
            heading: "Cuándo elegir hosting compartido",
            body: [
              "Elige hosting compartido si quieres publicar una o varias webs sin administrar servidores, con cPanel, SSL y copias incluidas, y al menor coste. Es lo ideal para la mayoría de webs de WordPress.",
            ],
          },
          {
            heading: "Cuándo elegir un VPS",
            body: [
              "Elige un VPS si necesitas recursos dedicados y estables, instalar software a medida, alojar aplicaciones o APIs, o tener control total (root). También si tu web ha crecido y el hosting compartido se te queda corto.",
            ],
          },
          {
            heading: "En resumen",
            body: [
              "Empieza en hosting compartido si tu prioridad es la sencillez; pasa a VPS cuando necesites control y recursos dedicados. En ViaHost puedes tener ambos, con precio plano y protección DDoS incluida.",
            ],
          },
        ],
        faq: [
          {
            q: "¿Un VPS es más rápido que un hosting compartido?",
            a: "Suele rendir de forma más estable porque los recursos son dedicados y no se comparten con otras webs, pero un buen hosting compartido con NVMe es más que suficiente para la mayoría de sitios.",
          },
          {
            q: "¿Necesito conocimientos técnicos para un VPS?",
            a: "Sí, algo: administras el sistema por SSH o con un panel. Si no quieres administrar nada, el hosting compartido con cPanel es mejor opción.",
          },
          {
            q: "¿Puedo empezar en hosting y pasar a VPS?",
            a: "Sí. Es lo habitual: empiezas en hosting compartido y migras a un VPS cuando el proyecto lo pide.",
          },
        ],
        cta: "Ver planes de VPS",
      },
      en: {
        title: "VPS vs shared hosting: which to choose",
        description:
          "The differences between a VPS and shared hosting, and how to choose for your project: control, resources, performance and price.",
        intro: [
          "Shared hosting and a VPS solve different needs. The quick way to decide: if you want to publish a site with minimal maintenance, shared hosting; if you need full server control and dedicated resources, a VPS.",
        ],
        sections: [
          {
            heading: "What shared hosting is",
            body: [
              "On shared hosting your site lives alongside others on the same server and you manage everything from a panel like cPanel. You do not administer the operating system: you install WordPress, upload your site and forget about maintenance.",
              "It is the simplest and cheapest option for websites, blogs and small to medium shops.",
            ],
          },
          {
            heading: "What a VPS is",
            body: [
              "A VPS (virtual private server) gives you a machine with dedicated resources (vCPU, RAM and NVMe disk) and root access: you install whatever you want and control the system top to bottom.",
              "In exchange for that power and freedom, you handle the administration (or run a panel on top).",
            ],
          },
          {
            heading: "When to choose shared hosting",
            body: [
              "Choose shared hosting if you want to publish one or more sites without managing servers, with cPanel, SSL and backups included, at the lowest cost. It is ideal for most WordPress sites.",
            ],
          },
          {
            heading: "When to choose a VPS",
            body: [
              "Choose a VPS if you need dedicated, stable resources, custom software, hosting apps or APIs, or full control (root). Also if your site has grown and shared hosting is no longer enough.",
            ],
          },
          {
            heading: "In short",
            body: [
              "Start on shared hosting if simplicity is your priority; move to a VPS when you need control and dedicated resources. At ViaHost you can have both, with flat pricing and DDoS protection included.",
            ],
          },
        ],
        faq: [
          {
            q: "Is a VPS faster than shared hosting?",
            a: "It usually performs more consistently because resources are dedicated and not shared with other sites, but good shared hosting on NVMe is more than enough for most sites.",
          },
          {
            q: "Do I need technical skills for a VPS?",
            a: "Yes, some: you administer the system over SSH or with a panel. If you do not want to administer anything, shared hosting with cPanel is a better fit.",
          },
          {
            q: "Can I start on hosting and move to a VPS?",
            a: "Yes. It is the usual path: you start on shared hosting and migrate to a VPS when the project calls for it.",
          },
        ],
        cta: "See the VPS plans",
      },
      fr: {
        title: "VPS vs hébergement mutualisé : lequel choisir",
        description:
          "Les différences entre un VPS et un hébergement mutualisé, et comment choisir selon votre projet : contrôle, ressources, performances et prix.",
        intro: [
          "L'hébergement mutualisé et le VPS répondent à des besoins différents. La façon rapide de décider : si vous voulez publier un site avec un minimum de maintenance, l'hébergement mutualisé ; si vous avez besoin d'un contrôle total et de ressources dédiées, un VPS.",
        ],
        sections: [
          {
            heading: "Qu'est-ce que l'hébergement mutualisé",
            body: [
              "En hébergement mutualisé, votre site cohabite avec d'autres sur le même serveur et vous gérez tout depuis un panneau comme cPanel. Vous n'administrez pas le système : vous installez WordPress, publiez votre site et oubliez la maintenance.",
              "C'est l'option la plus simple et la moins chère pour les sites, blogs et petites boutiques.",
            ],
          },
          {
            heading: "Qu'est-ce qu'un VPS",
            body: [
              "Un VPS (serveur privé virtuel) vous donne une machine avec des ressources dédiées (vCPU, RAM et disque NVMe) et un accès root : vous installez ce que vous voulez et contrôlez le système de bout en bout.",
              "En échange de cette puissance, vous gérez l'administration (ou utilisez un panneau par-dessus).",
            ],
          },
          {
            heading: "Quand choisir l'hébergement mutualisé",
            body: [
              "Choisissez l'hébergement mutualisé si vous voulez publier un ou plusieurs sites sans administrer de serveurs, avec cPanel, SSL et sauvegardes inclus, au coût le plus bas. Idéal pour la plupart des sites WordPress.",
            ],
          },
          {
            heading: "Quand choisir un VPS",
            body: [
              "Choisissez un VPS si vous avez besoin de ressources dédiées et stables, de logiciels sur mesure, d'héberger des applications ou des API, ou d'un contrôle total (root). Aussi si votre site a grandi et que le mutualisé ne suffit plus.",
            ],
          },
          {
            heading: "En résumé",
            body: [
              "Commencez en mutualisé si la simplicité prime ; passez au VPS quand vous avez besoin de contrôle et de ressources dédiées. Chez ViaHost, vous pouvez avoir les deux, à prix fixe et avec protection DDoS incluse.",
            ],
          },
        ],
        faq: [
          {
            q: "Un VPS est-il plus rapide que l'hébergement mutualisé ?",
            a: "Il offre généralement des performances plus régulières car les ressources sont dédiées, mais un bon mutualisé sur NVMe suffit largement pour la plupart des sites.",
          },
          {
            q: "Faut-il des compétences techniques pour un VPS ?",
            a: "Oui, un peu : vous administrez le système en SSH ou avec un panneau. Si vous ne voulez rien administrer, le mutualisé avec cPanel convient mieux.",
          },
          {
            q: "Puis-je commencer en mutualisé et passer au VPS ?",
            a: "Oui. C'est le parcours habituel : vous commencez en mutualisé et migrez vers un VPS quand le projet le demande.",
          },
        ],
        cta: "Voir les formules VPS",
      },
    },
  },
  {
    slug: "migrar-hosting-cpanel-gratis",
    date: "2026-08-27",
    type: "howto",
    ctaHref: "/hosting",
    content: {
      es: {
        title: "Cómo migrar tu hosting cPanel gratis",
        description:
          "Guía paso a paso para migrar tu hosting cPanel a ViaHost sin coste y sin cortes: qué necesitas, cómo se hace y cómo verificarlo.",
        intro: [
          "Si tu web y tus correos están en un hosting con cPanel, migrarlos a ViaHost es gratis y sin cortes: nosotros traemos los datos y tú solo apuntas el dominio al final. Estos son los pasos.",
        ],
        sections: [
          {
            heading: "Reúne los datos de tu hosting actual",
            body: [
              "Ten a mano el acceso a tu cPanel actual (usuario y contraseña) o los datos de tu proveedor. Con eso basta para traer tu web, bases de datos y cuentas de correo.",
            ],
          },
          {
            heading: "Contrata el plan de hosting en ViaHost",
            body: [
              "Elige el plan que encaje con tu web. Al confirmar el pago, tu cuenta cPanel se crea automáticamente y recibes las credenciales por correo.",
            ],
          },
          {
            heading: "Solicita la migración gratuita",
            body: [
              "Abre un ticket de soporte con los accesos a tu hosting anterior. Copiamos tu web, tus bases de datos y tus buzones a tu nueva cuenta, sin que tengas que tocar nada.",
            ],
          },
          {
            heading: "Verifica en el dominio temporal",
            body: [
              "Tu cuenta nace con un dominio temporal para que puedas comprobar que todo funciona (web y correo) antes de tocar el DNS. Revisa que la web se ve bien y que los correos están.",
            ],
          },
          {
            heading: "Apunta tu dominio al nuevo servidor",
            body: [
              "Cuando esté todo comprobado, apunta el registro A de tu dominio a la IP del servidor. En cuanto propague el DNS, tu web y tu correo quedan servidos desde ViaHost, sin corte perceptible.",
            ],
          },
        ],
        faq: [
          {
            q: "¿La migración tiene coste?",
            a: "No. La migración de hosting cPanel a cPanel es gratuita.",
          },
          {
            q: "¿Se cae mi web durante la migración?",
            a: "No. Primero copiamos todo a tu nueva cuenta y lo verificas en un dominio temporal; el cambio solo ocurre cuando apuntas el DNS.",
          },
          {
            q: "¿Se migran también los correos?",
            a: "Sí. Traemos tus cuentas de correo y sus mensajes junto con la web y las bases de datos.",
          },
        ],
        cta: "Ver planes de hosting",
      },
      en: {
        title: "How to migrate your cPanel hosting for free",
        description:
          "Step-by-step guide to migrate your cPanel hosting to ViaHost at no cost and with no downtime: what you need, how it works and how to verify it.",
        intro: [
          "If your site and mailboxes are on cPanel hosting, moving them to ViaHost is free and downtime-free: we bring the data and you only point the domain at the end. Here are the steps.",
        ],
        sections: [
          {
            heading: "Gather your current hosting details",
            body: [
              "Have your current cPanel access (username and password) or your provider details ready. That is enough to bring your site, databases and email accounts.",
            ],
          },
          {
            heading: "Order the hosting plan at ViaHost",
            body: [
              "Choose the plan that fits your site. When payment is confirmed, your cPanel account is created automatically and the credentials are emailed to you.",
            ],
          },
          {
            heading: "Request the free migration",
            body: [
              "Open a support ticket with access to your previous host. We copy your site, databases and mailboxes to your new account, with nothing for you to do.",
            ],
          },
          {
            heading: "Verify on the temporary domain",
            body: [
              "Your account starts with a temporary domain so you can check everything works (site and email) before touching DNS. Confirm the site looks right and the mailboxes are there.",
            ],
          },
          {
            heading: "Point your domain to the new server",
            body: [
              "Once everything is checked, point your domain's A record to the server IP. As soon as DNS propagates, your site and email are served from ViaHost, with no noticeable downtime.",
            ],
          },
        ],
        faq: [
          { q: "Does the migration cost anything?", a: "No. cPanel-to-cPanel hosting migration is free." },
          {
            q: "Does my site go down during the migration?",
            a: "No. We first copy everything to your new account and you verify it on a temporary domain; the switch only happens when you point DNS.",
          },
          {
            q: "Are emails migrated too?",
            a: "Yes. We bring your email accounts and their messages along with the site and databases.",
          },
        ],
        cta: "See the hosting plans",
      },
      fr: {
        title: "Comment migrer votre hébergement cPanel gratuitement",
        description:
          "Guide étape par étape pour migrer votre hébergement cPanel vers ViaHost sans frais et sans coupure : ce qu'il faut, comment ça marche et comment vérifier.",
        intro: [
          "Si votre site et vos emails sont sur un hébergement cPanel, les déplacer vers ViaHost est gratuit et sans coupure : nous transférons les données et vous ne faites que pointer le domaine à la fin. Voici les étapes.",
        ],
        sections: [
          {
            heading: "Rassemblez les informations de votre hébergement actuel",
            body: [
              "Ayez sous la main l'accès à votre cPanel actuel (identifiant et mot de passe) ou les informations de votre fournisseur. Cela suffit pour transférer votre site, vos bases de données et vos comptes email.",
            ],
          },
          {
            heading: "Commandez la formule d'hébergement chez ViaHost",
            body: [
              "Choisissez la formule adaptée à votre site. Au paiement confirmé, votre compte cPanel est créé automatiquement et les identifiants vous sont envoyés par email.",
            ],
          },
          {
            heading: "Demandez la migration gratuite",
            body: [
              "Ouvrez un ticket avec l'accès à votre ancien hébergeur. Nous copions votre site, vos bases de données et vos boîtes mail vers votre nouveau compte, sans rien à faire de votre côté.",
            ],
          },
          {
            heading: "Vérifiez sur le domaine temporaire",
            body: [
              "Votre compte démarre avec un domaine temporaire pour vérifier que tout fonctionne (site et email) avant de toucher au DNS. Confirmez que le site s'affiche bien et que les boîtes mail sont là.",
            ],
          },
          {
            heading: "Pointez votre domaine vers le nouveau serveur",
            body: [
              "Une fois tout vérifié, pointez l'enregistrement A de votre domaine vers l'IP du serveur. Dès que le DNS se propage, votre site et vos emails sont servis depuis ViaHost, sans coupure perceptible.",
            ],
          },
        ],
        faq: [
          { q: "La migration a-t-elle un coût ?", a: "Non. La migration d'hébergement cPanel vers cPanel est gratuite." },
          {
            q: "Mon site tombe-t-il pendant la migration ?",
            a: "Non. Nous copions d'abord tout vers votre nouveau compte et vous le vérifiez sur un domaine temporaire ; le basculement n'a lieu que lorsque vous pointez le DNS.",
          },
          {
            q: "Les emails sont-ils aussi migrés ?",
            a: "Oui. Nous transférons vos comptes email et leurs messages avec le site et les bases de données.",
          },
        ],
        cta: "Voir les formules d'hébergement",
      },
    },
  },
];

const byDateDesc = (a: BlogPost, b: BlogPost) => (a.date < b.date ? 1 : -1);

/** Todos los posts, más recientes primero. */
export function allPosts(): BlogPost[] {
  return [...posts].sort(byDateDesc);
}

/** Un post por su slug (o `undefined`). */
export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
