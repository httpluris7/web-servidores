// noVNC no publica tipos. La forma real (RFB) la fijamos en el punto de uso
// (ConsoleView) con un `as`; aquí solo declaramos el módulo para que TypeScript
// no falle por falta de declaración.
declare module "@novnc/novnc";
