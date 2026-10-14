import "./App.css";
import {
  SessionsWorkspace,
} from "./features/sessions/components/SessionsWorkspace";

export const App = () => (
  <main className="app">
    <h1>Training sessions</h1>
    <SessionsWorkspace />
  </main>
);
