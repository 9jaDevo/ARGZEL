import { Home, CalendarDays, Mic, Settings } from "lucide-react";
type Destination = "home" | "reminders" | "settings";
const destinations = [
  { id: "home", label: "Home", icon: Home },
  { id: "reminders", label: "Reminders", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
export function MobileNavigation({
  screen,
  onNavigate,
  onCreate,
}: {
  screen: string;
  onNavigate: (screen: Destination) => void;
  onCreate: () => void;
}) {
  if (!["home", "reminders", "settings", "details"].includes(screen))
    return null;
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {destinations.map((item, index) => (
        <span className="nav-slot" key={item.id}>
          {index === 2 && (
            <button
              className="nav-mic"
              aria-label="Create a voice reminder"
              onClick={onCreate}
            >
              <Mic size={23} aria-hidden="true" />
            </button>
          )}
          <button
            aria-current={
              screen === item.id ||
              (item.id === "reminders" && screen === "details")
                ? "page"
                : undefined
            }
            className={
              screen === item.id ||
              (item.id === "reminders" && screen === "details")
                ? "active"
                : ""
            }
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={21} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}
