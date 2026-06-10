"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
};

/** Reveal con stagger; respeta prefers-reduced-motion (cae a fade simple). */
export function Reveal({ children, className, delay = 0, as = "div" }: Props) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      custom={delay}
      variants={
        reduce
          ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.4 } } }
          : fadeUp
      }
    >
      {children}
    </MotionTag>
  );
}
