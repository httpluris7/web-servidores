/** Preguntas frecuentes reutilizables por las páginas de producto. */

export type FAQItem = { q: string; a: string };

export const vpsFaq: FAQItem[] = [
  {
    q: "How long does it take for the VPS to be ready?",
    a: "Provisioning is automatic: from the moment payment is confirmed, your server is online and reachable over SSH in under 60 seconds.",
  },
  {
    q: "Does DDoS protection cost extra?",
    a: "No. Mitigation is always active at the network edge and included in every plan, with no per-attack limit and no surprise charges.",
  },
  {
    q: "Can I change plans later on?",
    a: "Yes. You can scale your plan from the panel without migrating hosts. The change is applied live and you only pay the prorated difference.",
  },
  {
    q: "Which operating systems can I install?",
    a: "Images for Ubuntu, Debian, AlmaLinux, Rocky and Windows Server, plus templates with Docker preinstalled. You can also upload your own ISO.",
  },
  {
    q: "Is traffic really unlimited?",
    a: "Traffic is not billed by volume. The uplink is 10 Gbps fairly shared; there is no port overselling and no throttling based on usage.",
  },
  {
    q: "Is there a minimum contract term?",
    a: "No. Billing is monthly and you can cancel whenever you want from the panel. No setup fees and no early-cancellation penalty.",
  },
];

export const dedicatedFaq: FAQItem[] = [
  {
    q: "Is the bandwidth guaranteed or shared?",
    a: "The uplink listed on each plan is dedicated and guaranteed at the port level. There is no overselling: the capacity you order is the capacity available to you at all times.",
  },
  {
    q: "How long does delivery of a dedicated server take?",
    a: "In-stock models are delivered automatically within minutes. Custom configurations may take up to 24 hours; you'll see this indicated when ordering.",
  },
  {
    q: "Does it include IPMI/KVM access?",
    a: "Yes. Every dedicated server includes out-of-band remote management (IPMI/KVM) to reinstall, access the console and run diagnostics without relying on support.",
  },
  {
    q: "Can I request a custom configuration?",
    a: "Yes. Custom disks, RAM, 25/100 Gbps network cards or RAID: contact the sales team and we'll put together a quote.",
  },
  {
    q: "Which RAID and disks do you support?",
    a: "Software and hardware RAID on NVMe Gen4 and high-capacity HDD. Storage configurations support an NVMe cache to speed up reads.",
  },
  {
    q: "Does DDoS protection also apply to bare metal?",
    a: "Yes. The same mitigation of up to 25 Tbps protects VPS and dedicated servers alike, at no additional cost and with no reconfiguration on your part.",
  },
];
