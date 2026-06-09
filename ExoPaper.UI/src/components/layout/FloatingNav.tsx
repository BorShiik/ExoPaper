import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Globe, FileText } from "lucide-react";
import { useT } from "../../i18n/LanguageContext";

export default function FloatingNav() {
  const location = useLocation();
  const t = useT();

  const navigation = [
    { name: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { name: t("nav.planets"), href: "/planets", icon: Globe },
    { name: t("nav.papers"), href: "/papers", icon: FileText },
  ];

  return (
    <nav className="fixed left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 rounded-[24px] bg-[#2E3440]/60 backdrop-blur-xl border border-[#434C5E] p-2 shadow-2xl transition-all duration-300 pointer-events-auto w-[52px] hover:w-48 group overflow-hidden">
      {navigation.map((item) => {
        const isActive =
          item.href === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.href);

        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center gap-3 rounded-full p-2.5 transition-all duration-300 shrink-0 w-full ${
              isActive
                ? "bg-[#81A1C1]/20 text-[#88C0D0] shadow-[0_0_15px_rgba(129,161,193,0.3)]"
                : "text-[#D8DEE9] hover:bg-[#3B4252]/60 hover:text-[#ECEFF4]"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="opacity-0 whitespace-nowrap transition-opacity duration-300 group-hover:opacity-100 font-medium tracking-wide text-sm">
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
