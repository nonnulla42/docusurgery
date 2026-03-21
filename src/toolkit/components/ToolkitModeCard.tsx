import type { ToolkitMode, ToolkitModeDefinition } from "../types/toolkit";

interface ToolkitModeCardProps {
  mode: ToolkitModeDefinition;
  activeMode: ToolkitMode;
  onSelect: (mode: ToolkitMode) => void;
}

export function ToolkitModeCard({ mode, activeMode, onSelect }: ToolkitModeCardProps) {
  const Icon = mode.icon;
  const isActive = activeMode === mode.id;

  return (
    <button
      type="button"
      className={`toolkit-mode-card${isActive ? " toolkit-mode-card-active" : ""}`}
      onClick={() => onSelect(mode.id)}
      aria-pressed={isActive}
    >
      <span className="toolkit-mode-card-top">
        <span className="toolkit-mode-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="toolkit-mode-badge">{mode.badge}</span>
      </span>

      <span className="toolkit-mode-title-row">
        <span className="toolkit-mode-title">{mode.title}</span>
        <span className="toolkit-mode-status">{mode.status}</span>
      </span>

      <span className="toolkit-mode-description">{mode.description}</span>

      <span className="toolkit-mode-list" aria-hidden="true">
        {mode.bullets.map((bullet) => (
          <span key={bullet} className="toolkit-mode-pill">
            {bullet}
          </span>
        ))}
      </span>
    </button>
  );
}
