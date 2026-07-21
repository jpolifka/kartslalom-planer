// Registriert zusätzliche Vitest/Jest-Matcher (z. B. toBeInTheDocument,
// toBeDisabled), die in den Testdateien projektweit genutzt werden — via
// vite.config.ts `test.setupFiles` einmalig vor allen Tests geladen.
import "@testing-library/jest-dom";
