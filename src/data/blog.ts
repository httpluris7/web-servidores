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
  {
    slug: "instalar-wordpress-en-vps",
    date: "2026-08-13",
    type: "howto",
    ctaHref: "/vps",
    content: {
      es: {
        title: "Cómo instalar WordPress en un VPS",
        description:
          "Guía paso a paso para instalar WordPress en un VPS: del despliegue del servidor al dominio con SSL. Con el atajo si prefieres cPanel.",
        intro: [
          "Instalar WordPress en un VPS te da control total del servidor. Si prefieres el camino rápido, un hosting con cPanel lo instala en un clic con Softaculous; si quieres hacerlo tú en un VPS, estos son los pasos.",
        ],
        sections: [
          { heading: "Despliega el VPS", body: ["Contrata un VPS y elige una imagen de Ubuntu o Debian. En cuanto se aprovisiona recibes la IP y el acceso root."] },
          { heading: "Conéctate por SSH", body: ["Accede al servidor por SSH con el usuario root y la clave que recibiste. Actualiza el sistema antes de empezar."] },
          { heading: "Instala el stack web", body: ["Instala un servidor web (Nginx o Apache), PHP y MariaDB. Como alternativa, instala un panel gratuito para gestionarlo desde una interfaz."] },
          { heading: "Crea la base de datos", body: ["Crea una base de datos y un usuario para WordPress y anota sus credenciales."] },
          { heading: "Instala WordPress", body: ["Descarga WordPress, colócalo en la carpeta del sitio y completa el asistente con los datos de la base de datos."] },
          { heading: "Apunta el dominio y activa SSL", body: ["Apunta el registro A de tu dominio a la IP del VPS y emite un certificado SSL gratuito (Let's Encrypt). Tu WordPress queda accesible por HTTPS."] },
        ],
        faq: [
          { q: "¿Es mejor WordPress en VPS o en hosting compartido?", a: "En hosting compartido con cPanel es más sencillo (instalación en un clic). En un VPS tienes control total y recursos dedicados, a cambio de administrarlo tú." },
          { q: "¿Cuánta RAM necesita WordPress?", a: "Un WordPress con tráfico moderado funciona bien desde 2 GB de RAM; para tiendas o mucho tráfico conviene más." },
          { q: "¿Necesito saber usar la terminal?", a: "Para instalarlo a mano en un VPS, sí. Si no quieres terminal, usa hosting cPanel con Softaculous." },
        ],
        cta: "Ver planes de VPS",
      },
      en: {
        title: "How to install WordPress on a VPS",
        description:
          "Step-by-step guide to install WordPress on a VPS: from deploying the server to the domain with SSL. With the shortcut if you prefer cPanel.",
        intro: [
          "Installing WordPress on a VPS gives you full control of the server. If you prefer the fast path, cPanel hosting installs it in one click with Softaculous; if you want to do it yourself on a VPS, here are the steps.",
        ],
        sections: [
          { heading: "Deploy the VPS", body: ["Order a VPS and choose an Ubuntu or Debian image. Once provisioned you get the IP and root access."] },
          { heading: "Connect over SSH", body: ["Access the server over SSH with the root user and the key you received. Update the system before you start."] },
          { heading: "Install the web stack", body: ["Install a web server (Nginx or Apache), PHP and MariaDB. Alternatively, install a free panel to manage it from a UI."] },
          { heading: "Create the database", body: ["Create a database and a user for WordPress and note the credentials."] },
          { heading: "Install WordPress", body: ["Download WordPress, place it in the site folder and complete the wizard with the database details."] },
          { heading: "Point the domain and enable SSL", body: ["Point your domain's A record to the VPS IP and issue a free SSL certificate (Let's Encrypt). Your WordPress is now reachable over HTTPS."] },
        ],
        faq: [
          { q: "Is WordPress better on a VPS or shared hosting?", a: "Shared hosting with cPanel is simpler (one-click install). On a VPS you get full control and dedicated resources, in exchange for managing it yourself." },
          { q: "How much RAM does WordPress need?", a: "A WordPress site with moderate traffic runs fine from 2 GB of RAM; for shops or heavy traffic, more is better." },
          { q: "Do I need to know how to use the terminal?", a: "To install it by hand on a VPS, yes. If you do not want the terminal, use cPanel hosting with Softaculous." },
        ],
        cta: "See the VPS plans",
      },
      fr: {
        title: "Comment installer WordPress sur un VPS",
        description:
          "Guide étape par étape pour installer WordPress sur un VPS : du déploiement du serveur au domaine avec SSL. Avec le raccourci si vous préférez cPanel.",
        intro: [
          "Installer WordPress sur un VPS vous donne un contrôle total du serveur. Si vous préférez la voie rapide, un hébergement cPanel l'installe en un clic avec Softaculous ; si vous voulez le faire vous-même sur un VPS, voici les étapes.",
        ],
        sections: [
          { heading: "Déployez le VPS", body: ["Commandez un VPS et choisissez une image Ubuntu ou Debian. Une fois provisionné, vous recevez l'IP et l'accès root."] },
          { heading: "Connectez-vous en SSH", body: ["Accédez au serveur en SSH avec l'utilisateur root et la clé reçue. Mettez à jour le système avant de commencer."] },
          { heading: "Installez la pile web", body: ["Installez un serveur web (Nginx ou Apache), PHP et MariaDB. Sinon, installez un panneau gratuit pour le gérer depuis une interface."] },
          { heading: "Créez la base de données", body: ["Créez une base de données et un utilisateur pour WordPress et notez leurs identifiants."] },
          { heading: "Installez WordPress", body: ["Téléchargez WordPress, placez-le dans le dossier du site et complétez l'assistant avec les informations de la base de données."] },
          { heading: "Pointez le domaine et activez SSL", body: ["Pointez l'enregistrement A de votre domaine vers l'IP du VPS et émettez un certificat SSL gratuit (Let's Encrypt). Votre WordPress est accessible en HTTPS."] },
        ],
        faq: [
          { q: "WordPress est-il meilleur sur un VPS ou en mutualisé ?", a: "Le mutualisé avec cPanel est plus simple (installation en un clic). Sur un VPS, vous avez un contrôle total et des ressources dédiées, en échange de la gestion." },
          { q: "Combien de RAM faut-il pour WordPress ?", a: "Un WordPress à trafic modéré fonctionne bien à partir de 2 Go de RAM ; pour des boutiques ou beaucoup de trafic, davantage est préférable." },
          { q: "Faut-il savoir utiliser le terminal ?", a: "Pour l'installer à la main sur un VPS, oui. Si vous ne voulez pas de terminal, utilisez l'hébergement cPanel avec Softaculous." },
        ],
        cta: "Voir les formules VPS",
      },
    },
  },
  {
    slug: "que-es-cpanel",
    date: "2026-08-06",
    type: "article",
    ctaHref: "/hosting",
    content: {
      es: {
        title: "Qué es cPanel y para qué sirve",
        description: "cPanel explicado en claro: qué es, qué puedes hacer con él y por qué es el panel de hosting más extendido.",
        intro: ["cPanel es el panel de control de hosting más usado del mundo. Te permite gestionar tu alojamiento web desde una interfaz gráfica, sin tocar la terminal."],
        sections: [
          { heading: "Qué es cPanel", body: ["cPanel es un panel de control web que gestiona tu cuenta de hosting: dominios, correos, bases de datos, archivos y certificados SSL, todo desde el navegador."] },
          { heading: "Qué puedes hacer con cPanel", body: ["Crear cuentas de correo, subir tu web por gestor de archivos o FTP, crear bases de datos, gestionar dominios y subdominios, activar SSL y ver estadísticas."] },
          { heading: "cPanel y Softaculous", body: ["cPanel incluye instaladores como Softaculous, que montan WordPress y cientos de aplicaciones en un clic, sin configuración manual."] },
          { heading: "Por qué elegir un hosting con cPanel", body: ["Porque es estándar, está muy documentado y facilita migrar entre proveedores que también usan cPanel. Es la opción más cómoda para la mayoría de webs."] },
        ],
        faq: [
          { q: "¿cPanel es gratis?", a: "cPanel es una licencia de pago para el proveedor; para ti viene incluido en el plan de hosting." },
          { q: "¿Puedo migrar entre proveedores con cPanel?", a: "Sí. Al ser estándar, la migración cPanel a cPanel es directa y en ViaHost es gratuita." },
          { q: "¿cPanel sirve para WordPress?", a: "Sí, es ideal: instalas WordPress en un clic con Softaculous y gestionas todo desde el panel." },
        ],
        cta: "Ver planes de hosting",
      },
      en: {
        title: "What cPanel is and what it is for",
        description: "cPanel explained plainly: what it is, what you can do with it and why it is the most widely used hosting panel.",
        intro: ["cPanel is the most used hosting control panel in the world. It lets you manage your web hosting from a graphical interface, without touching the terminal."],
        sections: [
          { heading: "What cPanel is", body: ["cPanel is a web control panel that manages your hosting account: domains, email, databases, files and SSL certificates, all from the browser."] },
          { heading: "What you can do with cPanel", body: ["Create email accounts, upload your site via file manager or FTP, create databases, manage domains and subdomains, enable SSL and view statistics."] },
          { heading: "cPanel and Softaculous", body: ["cPanel includes installers like Softaculous, which set up WordPress and hundreds of apps in one click, with no manual configuration."] },
          { heading: "Why choose hosting with cPanel", body: ["Because it is standard, very well documented and makes it easy to migrate between providers that also use cPanel. It is the most convenient option for most sites."] },
        ],
        faq: [
          { q: "Is cPanel free?", a: "cPanel is a paid license for the provider; for you it is included in the hosting plan." },
          { q: "Can I migrate between providers with cPanel?", a: "Yes. Being standard, cPanel-to-cPanel migration is direct, and at ViaHost it is free." },
          { q: "Is cPanel good for WordPress?", a: "Yes, it is ideal: you install WordPress in one click with Softaculous and manage everything from the panel." },
        ],
        cta: "See the hosting plans",
      },
      fr: {
        title: "Qu'est-ce que cPanel et à quoi ça sert",
        description: "cPanel expliqué clairement : ce que c'est, ce que vous pouvez en faire et pourquoi c'est le panneau d'hébergement le plus répandu.",
        intro: ["cPanel est le panneau de contrôle d'hébergement le plus utilisé au monde. Il vous permet de gérer votre hébergement depuis une interface graphique, sans toucher au terminal."],
        sections: [
          { heading: "Qu'est-ce que cPanel", body: ["cPanel est un panneau web qui gère votre compte d'hébergement : domaines, emails, bases de données, fichiers et certificats SSL, le tout depuis le navigateur."] },
          { heading: "Ce que vous pouvez faire avec cPanel", body: ["Créer des comptes email, envoyer votre site via gestionnaire de fichiers ou FTP, créer des bases de données, gérer domaines et sous-domaines, activer SSL et voir des statistiques."] },
          { heading: "cPanel et Softaculous", body: ["cPanel inclut des installateurs comme Softaculous, qui installent WordPress et des centaines d'applications en un clic, sans configuration manuelle."] },
          { heading: "Pourquoi choisir un hébergement avec cPanel", body: ["Parce qu'il est standard, très bien documenté et facilite la migration entre fournisseurs qui utilisent aussi cPanel. C'est l'option la plus pratique pour la plupart des sites."] },
        ],
        faq: [
          { q: "cPanel est-il gratuit ?", a: "cPanel est une licence payante pour le fournisseur ; pour vous, il est inclus dans la formule d'hébergement." },
          { q: "Puis-je migrer entre fournisseurs avec cPanel ?", a: "Oui. Étant standard, la migration cPanel vers cPanel est directe, et chez ViaHost elle est gratuite." },
          { q: "cPanel convient-il à WordPress ?", a: "Oui, c'est idéal : vous installez WordPress en un clic avec Softaculous et gérez tout depuis le panneau." },
        ],
        cta: "Voir les formules d'hébergement",
      },
    },
  },
  {
    slug: "privacidad-whois-que-es",
    date: "2026-07-30",
    type: "article",
    ctaHref: "/dominios",
    content: {
      es: {
        title: "Qué es la privacidad WHOIS y por qué importa",
        description: "Qué es el WHOIS, qué datos tuyos expone al registrar un dominio y cómo la privacidad WHOIS protege tu información.",
        intro: ["Cuando registras un dominio, tus datos personales pueden acabar en una base de datos pública llamada WHOIS. La privacidad WHOIS evita que aparezcan."],
        sections: [
          { heading: "Qué es el WHOIS", body: ["El WHOIS es un directorio público que asocia cada dominio con los datos de su titular: nombre, dirección, email y teléfono."] },
          { heading: "Qué riesgo tiene exponer tus datos", body: ["Sin privacidad, cualquiera puede consultar tus datos personales en el WHOIS, lo que suele traducirse en spam, llamadas comerciales e intentos de suplantación."] },
          { heading: "Cómo funciona la privacidad WHOIS", body: ["Con la privacidad activada, en el registro público aparecen datos de protección en lugar de los tuyos; tú sigues siendo el titular real del dominio."] },
          { heading: "Privacidad incluida en ViaHost", body: ["En ViaHost la privacidad WHOIS viene incluida sin coste en cada dominio: tus datos personales nunca aparecen en el registro público."] },
        ],
        faq: [
          { q: "¿La privacidad WHOIS es legal?", a: "Sí. Es un servicio estándar y legítimo que protege tus datos personales sin cambiar la titularidad del dominio." },
          { q: "¿Sigo siendo el dueño del dominio?", a: "Sí. La privacidad solo oculta tus datos en el WHOIS público; el dominio es tuyo." },
          { q: "¿Tiene coste en ViaHost?", a: "No. La privacidad WHOIS viene incluida sin coste en todos los dominios." },
        ],
        cta: "Registrar un dominio con privacidad",
      },
      en: {
        title: "What WHOIS privacy is and why it matters",
        description: "What WHOIS is, which of your data it exposes when you register a domain, and how WHOIS privacy protects your information.",
        intro: ["When you register a domain, your personal data can end up in a public database called WHOIS. WHOIS privacy keeps it from appearing."],
        sections: [
          { heading: "What WHOIS is", body: ["WHOIS is a public directory that ties each domain to its owner's data: name, address, email and phone."] },
          { heading: "The risk of exposing your data", body: ["Without privacy, anyone can look up your personal data in WHOIS, which usually means spam, sales calls and impersonation attempts."] },
          { heading: "How WHOIS privacy works", body: ["With privacy enabled, the public record shows protection data instead of yours; you remain the real owner of the domain."] },
          { heading: "Privacy included at ViaHost", body: ["At ViaHost, WHOIS privacy is included at no cost on every domain: your personal data never appears in the public registry."] },
        ],
        faq: [
          { q: "Is WHOIS privacy legal?", a: "Yes. It is a standard, legitimate service that protects your personal data without changing domain ownership." },
          { q: "Am I still the domain owner?", a: "Yes. Privacy only hides your data in the public WHOIS; the domain is yours." },
          { q: "Does it cost anything at ViaHost?", a: "No. WHOIS privacy is included at no cost on all domains." },
        ],
        cta: "Register a domain with privacy",
      },
      fr: {
        title: "Qu'est-ce que la confidentialité WHOIS et pourquoi c'est important",
        description: "Ce qu'est le WHOIS, quelles données il expose lors de l'enregistrement d'un domaine et comment la confidentialité WHOIS protège vos informations.",
        intro: ["Lorsque vous enregistrez un domaine, vos données personnelles peuvent se retrouver dans une base publique appelée WHOIS. La confidentialité WHOIS évite qu'elles apparaissent."],
        sections: [
          { heading: "Qu'est-ce que le WHOIS", body: ["Le WHOIS est un annuaire public qui associe chaque domaine aux données de son titulaire : nom, adresse, email et téléphone."] },
          { heading: "Le risque d'exposer vos données", body: ["Sans confidentialité, n'importe qui peut consulter vos données personnelles dans le WHOIS, ce qui se traduit souvent par du spam, des appels commerciaux et des tentatives d'usurpation."] },
          { heading: "Comment fonctionne la confidentialité WHOIS", body: ["Avec la confidentialité activée, le registre public affiche des données de protection à la place des vôtres ; vous restez le véritable titulaire du domaine."] },
          { heading: "Confidentialité incluse chez ViaHost", body: ["Chez ViaHost, la confidentialité WHOIS est incluse sans frais sur chaque domaine : vos données personnelles n'apparaissent jamais dans le registre public."] },
        ],
        faq: [
          { q: "La confidentialité WHOIS est-elle légale ?", a: "Oui. C'est un service standard et légitime qui protège vos données personnelles sans changer la propriété du domaine." },
          { q: "Suis-je toujours le propriétaire du domaine ?", a: "Oui. La confidentialité masque seulement vos données dans le WHOIS public ; le domaine est le vôtre." },
          { q: "Est-ce payant chez ViaHost ?", a: "Non. La confidentialité WHOIS est incluse sans frais sur tous les domaines." },
        ],
        cta: "Enregistrer un domaine avec confidentialité",
      },
    },
  },
  {
    slug: "que-es-proxmox-kvm-vps",
    date: "2026-07-23",
    type: "article",
    ctaHref: "/vps",
    content: {
      es: {
        title: "Qué es Proxmox y KVM en un VPS",
        description: "Proxmox y KVM explicados: qué son, qué significan para tu VPS y por qué importan la virtualización real y el aislamiento de recursos.",
        intro: ["Cuando contratas un VPS, la tecnología de virtualización determina cómo se reparten los recursos. Proxmox sobre KVM ofrece virtualización real con recursos aislados."],
        sections: [
          { heading: "Qué es KVM", body: ["KVM es una tecnología de virtualización del kernel de Linux que crea máquinas virtuales con su propio sistema operativo y recursos aislados, como si fueran servidores físicos."] },
          { heading: "Qué es Proxmox", body: ["Proxmox es una plataforma de gestión de máquinas virtuales sobre KVM. Permite crear, arrancar, apagar, hacer snapshots y administrar los VPS de forma robusta."] },
          { heading: "Por qué importa la virtualización real", body: ["Con KVM tus recursos (vCPU, RAM, disco) están aislados y no se comparten con otros clientes como en las virtualizaciones de tipo contenedor. Eso da rendimiento estable y más libertad: kernel propio y cualquier sistema operativo."] },
          { heading: "Proxmox en ViaHost", body: ["En ViaHost los VPS corren sobre Proxmox/KVM, con panel de gestión, consola noVNC y snapshots incluidos."] },
        ],
        faq: [
          { q: "¿KVM es mejor que la virtualización por contenedores?", a: "Para un VPS, KVM da mejor aislamiento y libertad (kernel propio, cualquier SO). Los contenedores comparten kernel y son más limitados." },
          { q: "¿Qué son los snapshots?", a: "Una copia del estado del VPS en un momento dado, a la que puedes volver si algo sale mal." },
          { q: "¿Puedo instalar cualquier sistema operativo?", a: "Con KVM sí: Linux (Ubuntu, Debian, AlmaLinux…) o Windows Server." },
        ],
        cta: "Ver planes de VPS",
      },
      en: {
        title: "What Proxmox and KVM are in a VPS",
        description: "Proxmox and KVM explained: what they are, what they mean for your VPS and why real virtualization and resource isolation matter.",
        intro: ["When you order a VPS, the virtualization technology determines how resources are shared. Proxmox on KVM offers real virtualization with isolated resources."],
        sections: [
          { heading: "What KVM is", body: ["KVM is a Linux kernel virtualization technology that creates virtual machines with their own operating system and isolated resources, as if they were physical servers."] },
          { heading: "What Proxmox is", body: ["Proxmox is a management platform for virtual machines on KVM. It lets you create, start, stop, snapshot and administer VPSs robustly."] },
          { heading: "Why real virtualization matters", body: ["With KVM your resources (vCPU, RAM, disk) are isolated and not shared with other customers like in container-type virtualization. That gives stable performance and more freedom: your own kernel and any operating system."] },
          { heading: "Proxmox at ViaHost", body: ["At ViaHost, VPSs run on Proxmox/KVM, with a management panel, noVNC console and snapshots included."] },
        ],
        faq: [
          { q: "Is KVM better than container virtualization?", a: "For a VPS, KVM gives better isolation and freedom (your own kernel, any OS). Containers share a kernel and are more limited." },
          { q: "What are snapshots?", a: "A copy of the VPS state at a given moment, which you can roll back to if something goes wrong." },
          { q: "Can I install any operating system?", a: "With KVM, yes: Linux (Ubuntu, Debian, AlmaLinux…) or Windows Server." },
        ],
        cta: "See the VPS plans",
      },
      fr: {
        title: "Qu'est-ce que Proxmox et KVM dans un VPS",
        description: "Proxmox et KVM expliqués : ce que c'est, ce que cela signifie pour votre VPS et pourquoi la virtualisation réelle et l'isolation des ressources comptent.",
        intro: ["Quand vous commandez un VPS, la technologie de virtualisation détermine comment les ressources sont partagées. Proxmox sur KVM offre une virtualisation réelle avec des ressources isolées."],
        sections: [
          { heading: "Qu'est-ce que KVM", body: ["KVM est une technologie de virtualisation du noyau Linux qui crée des machines virtuelles avec leur propre système d'exploitation et des ressources isolées, comme des serveurs physiques."] },
          { heading: "Qu'est-ce que Proxmox", body: ["Proxmox est une plateforme de gestion de machines virtuelles sur KVM. Elle permet de créer, démarrer, arrêter, faire des snapshots et administrer les VPS de façon robuste."] },
          { heading: "Pourquoi la virtualisation réelle compte", body: ["Avec KVM, vos ressources (vCPU, RAM, disque) sont isolées et non partagées avec d'autres clients comme dans la virtualisation par conteneurs. Cela donne des performances stables et plus de liberté : votre propre noyau et n'importe quel système."] },
          { heading: "Proxmox chez ViaHost", body: ["Chez ViaHost, les VPS tournent sur Proxmox/KVM, avec un panneau de gestion, une console noVNC et des snapshots inclus."] },
        ],
        faq: [
          { q: "KVM est-il meilleur que la virtualisation par conteneurs ?", a: "Pour un VPS, KVM offre une meilleure isolation et liberté (votre propre noyau, n'importe quel OS). Les conteneurs partagent un noyau et sont plus limités." },
          { q: "Que sont les snapshots ?", a: "Une copie de l'état du VPS à un instant donné, à laquelle vous pouvez revenir si quelque chose tourne mal." },
          { q: "Puis-je installer n'importe quel système d'exploitation ?", a: "Avec KVM, oui : Linux (Ubuntu, Debian, AlmaLinux…) ou Windows Server." },
        ],
        cta: "Voir les formules VPS",
      },
    },
  },
  {
    slug: "que-es-proteccion-ddos",
    date: "2026-07-16",
    type: "article",
    ctaHref: "/proteccion-ddos",
    content: {
      es: {
        title: "Qué es la protección DDoS y por qué la necesitas",
        description: "Qué es un ataque DDoS, cómo funciona la mitigación y por qué conviene que venga incluida en tu VPS o hosting.",
        intro: ["Un ataque DDoS intenta tumbar tu web saturándola con tráfico falso. La protección DDoS filtra ese tráfico antes de que llegue a tu servidor."],
        sections: [
          { heading: "Qué es un ataque DDoS", body: ["Un ataque de denegación de servicio distribuido (DDoS) envía una avalancha de peticiones desde muchos orígenes para saturar tu servidor y dejar tu web fuera de servicio."] },
          { heading: "Cómo funciona la mitigación", body: ["La mitigación analiza el tráfico en el borde de la red y descarta el malicioso, dejando pasar solo el legítimo. Tu servidor no llega a recibir el ataque."] },
          { heading: "Por qué conviene que venga incluida", body: ["Muchos proveedores cobran la protección aparte o por ataque. Incluida de serie, no tienes que configurar nada ni pagar extra cuando ocurre un ataque."] },
          { heading: "DDoS incluido en ViaHost", body: ["En ViaHost la mitigación DDoS está siempre activa e incluida en VPS y hosting, sin coste ni límite por ataque."] },
        ],
        faq: [
          { q: "¿La protección DDoS ralentiza mi web?", a: "No. El filtrado ocurre en el borde de la red y solo afecta al tráfico de ataque; el legítimo pasa con normalidad." },
          { q: "¿Tengo que configurar algo?", a: "No. En ViaHost está activa de serie, sin configuración por tu parte." },
          { q: "¿Cubre cualquier tamaño de ataque?", a: "La mitigación absorbe los ataques volumétricos habituales sin coste ni límite por ataque." },
        ],
        cta: "Ver la protección DDoS",
      },
      en: {
        title: "What DDoS protection is and why you need it",
        description: "What a DDoS attack is, how mitigation works and why it is best to have it included in your VPS or hosting.",
        intro: ["A DDoS attack tries to take down your site by flooding it with fake traffic. DDoS protection filters that traffic before it reaches your server."],
        sections: [
          { heading: "What a DDoS attack is", body: ["A distributed denial-of-service (DDoS) attack sends a flood of requests from many sources to overload your server and take your site offline."] },
          { heading: "How mitigation works", body: ["Mitigation analyzes traffic at the network edge and discards the malicious part, letting only legitimate traffic through. Your server never receives the attack."] },
          { heading: "Why it should be included", body: ["Many providers charge for protection separately or per attack. Included by default, you do not have to configure anything or pay extra when an attack happens."] },
          { heading: "DDoS included at ViaHost", body: ["At ViaHost, DDoS mitigation is always on and included in VPS and hosting, at no cost and with no per-attack limit."] },
        ],
        faq: [
          { q: "Does DDoS protection slow down my site?", a: "No. Filtering happens at the network edge and only affects attack traffic; legitimate traffic passes normally." },
          { q: "Do I have to configure anything?", a: "No. At ViaHost it is on by default, with nothing for you to set up." },
          { q: "Does it cover any attack size?", a: "Mitigation absorbs the usual volumetric attacks at no cost and with no per-attack limit." },
        ],
        cta: "See DDoS protection",
      },
      fr: {
        title: "Qu'est-ce que la protection DDoS et pourquoi en avez-vous besoin",
        description: "Ce qu'est une attaque DDoS, comment fonctionne la mitigation et pourquoi il vaut mieux qu'elle soit incluse dans votre VPS ou hébergement.",
        intro: ["Une attaque DDoS tente de faire tomber votre site en le saturant de faux trafic. La protection DDoS filtre ce trafic avant qu'il n'atteigne votre serveur."],
        sections: [
          { heading: "Qu'est-ce qu'une attaque DDoS", body: ["Une attaque par déni de service distribué (DDoS) envoie une avalanche de requêtes depuis de nombreuses sources pour surcharger votre serveur et mettre votre site hors service."] },
          { heading: "Comment fonctionne la mitigation", body: ["La mitigation analyse le trafic en bordure de réseau et rejette la partie malveillante, ne laissant passer que le trafic légitime. Votre serveur ne reçoit jamais l'attaque."] },
          { heading: "Pourquoi elle devrait être incluse", body: ["Beaucoup de fournisseurs facturent la protection séparément ou par attaque. Incluse d'office, vous n'avez rien à configurer ni à payer en plus quand une attaque survient."] },
          { heading: "DDoS inclus chez ViaHost", body: ["Chez ViaHost, la mitigation DDoS est toujours active et incluse dans les VPS et l'hébergement, sans frais ni limite par attaque."] },
        ],
        faq: [
          { q: "La protection DDoS ralentit-elle mon site ?", a: "Non. Le filtrage a lieu en bordure de réseau et n'affecte que le trafic d'attaque ; le trafic légitime passe normalement." },
          { q: "Dois-je configurer quelque chose ?", a: "Non. Chez ViaHost, elle est active d'office, sans configuration de votre part." },
          { q: "Couvre-t-elle n'importe quelle taille d'attaque ?", a: "La mitigation absorbe les attaques volumétriques habituelles sans frais ni limite par attaque." },
        ],
        cta: "Voir la protection DDoS",
      },
    },
  },
  {
    slug: "apuntar-dominio-registro-a",
    date: "2026-07-09",
    type: "howto",
    ctaHref: "/dominios",
    content: {
      es: {
        title: "Cómo apuntar un dominio a un servidor (registro A)",
        description: "Guía paso a paso para apuntar tu dominio a un servidor con un registro A: qué es, cómo se hace y cuánto tarda en propagar.",
        intro: ["Para que tu dominio muestre tu web, tienes que apuntarlo a la IP de tu servidor con un registro A. Estos son los pasos."],
        sections: [
          { heading: "Consigue la IP de tu servidor", body: ["Anota la dirección IP de tu VPS o de tu hosting (la encuentras en el panel o en el correo de alta)."] },
          { heading: "Entra en la gestión de DNS de tu dominio", body: ["Accede al editor de DNS de tu dominio, en el panel de tu registrador (en ViaHost, desde el área de cliente)."] },
          { heading: "Crea o edita el registro A", body: ["Crea un registro de tipo A con nombre @ (el dominio raíz) apuntando a la IP de tu servidor. Repite con www si quieres cubrir también esa versión."] },
          { heading: "Guarda y espera la propagación", body: ["Guarda los cambios. La propagación del DNS suele tardar de unos minutos a unas horas; a partir de ahí, tu dominio muestra tu web."] },
        ],
        faq: [
          { q: "¿Qué es un registro A?", a: "Es el registro DNS que asocia un nombre de dominio con una dirección IPv4 (para IPv6 se usa el registro AAAA)." },
          { q: "¿Cuánto tarda en propagar?", a: "Normalmente de minutos a unas horas, según el TTL configurado." },
          { q: "¿Y el correo?", a: "El correo usa registros MX, no el A. Configúralos aparte según tu proveedor de correo." },
        ],
        cta: "Gestionar mi dominio",
      },
      en: {
        title: "How to point a domain to a server (A record)",
        description: "Step-by-step guide to point your domain to a server with an A record: what it is, how to do it and how long propagation takes.",
        intro: ["For your domain to show your site, you have to point it to your server's IP with an A record. Here are the steps."],
        sections: [
          { heading: "Get your server's IP", body: ["Note the IP address of your VPS or hosting (you will find it in the panel or the welcome email)."] },
          { heading: "Open your domain's DNS management", body: ["Access your domain's DNS editor in your registrar's panel (at ViaHost, from your account area)."] },
          { heading: "Create or edit the A record", body: ["Create an A record with the name @ (the root domain) pointing to your server's IP. Repeat with www if you also want to cover that version."] },
          { heading: "Save and wait for propagation", body: ["Save the changes. DNS propagation usually takes from a few minutes to a few hours; after that, your domain shows your site."] },
        ],
        faq: [
          { q: "What is an A record?", a: "It is the DNS record that ties a domain name to an IPv4 address (for IPv6 you use the AAAA record)." },
          { q: "How long does propagation take?", a: "Usually from minutes to a few hours, depending on the configured TTL." },
          { q: "What about email?", a: "Email uses MX records, not the A record. Configure those separately according to your email provider." },
        ],
        cta: "Manage my domain",
      },
      fr: {
        title: "Comment pointer un domaine vers un serveur (enregistrement A)",
        description: "Guide étape par étape pour pointer votre domaine vers un serveur avec un enregistrement A : ce que c'est, comment le faire et le temps de propagation.",
        intro: ["Pour que votre domaine affiche votre site, vous devez le pointer vers l'IP de votre serveur avec un enregistrement A. Voici les étapes."],
        sections: [
          { heading: "Récupérez l'IP de votre serveur", body: ["Notez l'adresse IP de votre VPS ou de votre hébergement (vous la trouvez dans le panneau ou dans l'email d'activation)."] },
          { heading: "Ouvrez la gestion DNS de votre domaine", body: ["Accédez à l'éditeur DNS de votre domaine, dans le panneau de votre registrar (chez ViaHost, depuis votre espace client)."] },
          { heading: "Créez ou modifiez l'enregistrement A", body: ["Créez un enregistrement de type A avec le nom @ (le domaine racine) pointant vers l'IP de votre serveur. Répétez avec www si vous voulez aussi couvrir cette version."] },
          { heading: "Enregistrez et attendez la propagation", body: ["Enregistrez les changements. La propagation DNS prend généralement de quelques minutes à quelques heures ; ensuite, votre domaine affiche votre site."] },
        ],
        faq: [
          { q: "Qu'est-ce qu'un enregistrement A ?", a: "C'est l'enregistrement DNS qui associe un nom de domaine à une adresse IPv4 (pour l'IPv6, on utilise l'enregistrement AAAA)." },
          { q: "Combien de temps prend la propagation ?", a: "Généralement de quelques minutes à quelques heures, selon le TTL configuré." },
          { q: "Et pour l'email ?", a: "L'email utilise les enregistrements MX, pas l'enregistrement A. Configurez-les séparément selon votre fournisseur d'email." },
        ],
        cta: "Gérer mon domaine",
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
