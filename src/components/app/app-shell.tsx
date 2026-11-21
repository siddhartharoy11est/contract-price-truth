import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpenCheck,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  FileCheck2,
  FileText,
  FlaskConical,
  FolderOpen,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROLES } from "@/data/roles";
import type { RoleId } from "@/data/types";
import { useDemo, useDerived } from "@/lib/demo-store";
import { cn } from "@/lib/utils";
import { isDark, toggleTheme } from "@/lib/theme";
import { TourProvider } from "./guided-demo";

type NavPath =
  | "/"
  | "/documents"
  | "/suppliers"
  | "/price-book"
  | "/findings"
  | "/invoice-check"
  | "/legal"
  | "/tests"
  | "/about";
type NavItem = {
  to: NavPath;
  label: string;
  icon: LucideIcon;
  search?: { tab: "pending" | "clauses" };
};
type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  readOnly?: boolean;
};

/** Dev and Anika see Repository and Pricing read only. Only Procurement changes them. */
const READ_ONLY_PATHS = ["/documents", "/suppliers", "/price-book"];
const isReadOnlyFor = (role: RoleId, pathname: string) =>
  role !== "procurement" && READ_ONLY_PATHS.some((p) => pathname.startsWith(p));

const PAGE_TITLES: [string, string][] = [
  ["/documents/", "Document details"],
  ["/documents", "All Contracts"],
  ["/suppliers/", "Supplier workspace"],
  ["/suppliers", "Suppliers"],
  ["/price-book", "Price Book"],
  ["/invoice-check", "Invoice Check"],
  ["/findings", "Investigations"],
  ["/legal", "Legal Reviews"],
  ["/tests", "Prototype Validation"],
  ["/about", "About This Project"],
];

function ThemeToggle() {
  const [dark, setDarkState] = useState(false);
  useEffect(() => setDarkState(isDark()), []);
  const toggle = () => setDarkState(toggleTheme());
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        toggle();
      }}
    >
      {dark ? <Sun /> : <Moon />}
      {dark ? "Use light theme" : "Use dark theme"}
    </DropdownMenuItem>
  );
}

function AccountSelection() {
  const { selectAccount } = useDemo();
  const navigate = useNavigate();
  const accounts: { id: RoleId; description: string }[] = [
    { id: "procurement", description: "Review pricing terms, conflicts and investigations." },
    { id: "finance", description: "Check invoice lines and raise pricing investigations." },
    { id: "legal", description: "Decide escalated contractual conflicts." },
  ];
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 rounded-md" />
          <div>
            <p className="text-lg font-semibold tracking-tight">Contract Price Truth</p>
            <p className="text-sm text-muted-foreground">Brightwave Group demo workspace</p>
          </div>
        </div>
        <section className="surface overflow-hidden">
          <div className="border-b px-6 py-5">
            <h1 className="text-xl font-semibold">Choose a demo account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the workspace as one of the sample employees.
            </p>
          </div>
          <div className="divide-y">
            {accounts.map(({ id, description }) => {
              const role = ROLES.find((r) => r.id === id)!;
              return (
                <button
                  key={id}
                  aria-label={`Enter the workspace as ${role.name}`}
                  className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/60"
                  onClick={() => {
                    selectAccount(id);
                    void navigate({ to: "/" });
                  }}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {role.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{role.name}</span>
                    <span className="block text-sm text-muted-foreground">{role.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </section>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Simulated accounts, not real access control. No password is required. Workflow data is
          shared in this browser session.
        </p>
      </div>
    </main>
  );
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      {...(item.search ? { search: item.search } : {})}
      activeOptions={{ exact: item.to === "/" }}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className="flex h-9 items-center gap-3 rounded-md px-3 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function Navigation({
  collapsed,
  setCollapsed,
  mobile,
  closeMobile,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobile: boolean;
  closeMobile: () => void;
}) {
  const { state } = useDemo();
  const pathname = useLocation({ select: (l) => l.pathname });
  const groups: NavGroup[] = [];
  const readOnly = state.role !== "procurement";
  groups.push({
    id: "repository",
    label: "Repository",
    icon: FolderOpen,
    readOnly,
    items: [
      { to: "/documents", label: "All Contracts", icon: FileText },
      { to: "/suppliers", label: "Suppliers", icon: Users },
    ],
  });
  groups.push({
    id: "pricing",
    label: "Pricing",
    icon: CircleDollarSign,
    readOnly,
    items: readOnly
      ? [
          { to: "/price-book", label: "Price Book", icon: BookOpenCheck },
          {
            to: "/price-book",
            label: "Contractual Clauses",
            icon: Scale,
            search: { tab: "clauses" },
          },
        ]
      : [
          { to: "/price-book", label: "Price Book", icon: BookOpenCheck },
          {
            to: "/price-book",
            label: "Verification Queue",
            icon: FileCheck2,
            search: { tab: "pending" },
          },
        ],
  });
  if (state.role !== "legal") {
    groups.push({
      id: "operations",
      label: "Operations",
      icon: BarChart3,
      items: [
        { to: "/invoice-check", label: "Invoice Check", icon: FileCheck2 },
        { to: "/findings", label: "Investigations", icon: CircleDollarSign },
      ],
    });
  }
  if (state.role === "legal") {
    groups.push({
      id: "legal",
      label: "Legal",
      icon: Scale,
      items: [{ to: "/legal", label: "Legal Reviews", icon: Scale }],
    });
  }
  const currentGroup = groups.find((g) =>
    g.items.some((item) => pathname.startsWith(item.to) && item.to !== "/"),
  )?.id;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    currentGroup ? { [currentGroup]: true } : {},
  );
  const hideLabels = collapsed && !mobile;
  const onNavigate = () => {
    if (mobile) closeMobile();
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4",
          hideLabels && "justify-center px-2",
        )}
      >
        <img
          src="/favicon.svg"
          alt=""
          className="size-8 shrink-0 rounded-md ring-1 ring-sidebar-border"
        />
        {!hideLabels && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Contract Price Truth</p>
            <p className="text-[11px] text-sidebar-muted">Brightwave Group</p>
          </div>
        )}
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={closeMobile}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <SidebarLink
          item={{ to: "/", label: "Dashboard", icon: LayoutDashboard }}
          collapsed={hideLabels}
          onNavigate={onNavigate}
        />
        {groups.map((group) => {
          const Icon = group.icon;
          const open = Boolean(openGroups[group.id]);
          return (
            <div key={group.id} className="pt-3">
              <button
                className={cn(
                  "flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  hideLabels && "justify-center px-0",
                )}
                onClick={() => {
                  if (hideLabels) {
                    setCollapsed(false);
                    setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
                  } else setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }));
                }}
                aria-expanded={hideLabels ? undefined : open}
                title={hideLabels ? group.label : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {!hideLabels && (
                  <>
                    <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wide">
                      {group.label}
                    </span>
                    {group.readOnly && (
                      <span className="rounded border border-sidebar-border px-1.5 text-[10px] font-normal normal-case tracking-normal">
                        Read only
                      </span>
                    )}
                    <ChevronDown
                      className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
                    />
                  </>
                )}
              </button>
              {!hideLabels && open && (
                <div className="mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                  {group.items.map((item) => (
                    <SidebarLink
                      key={`${item.to}-${item.label}`}
                      item={item}
                      collapsed={false}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
        <SidebarLink
          item={{ to: "/about", label: "About This Project", icon: Info }}
          collapsed={hideLabels}
          onNavigate={onNavigate}
        />
        <SidebarLink
          item={{ to: "/tests", label: "Prototype Validation", icon: FlaskConical }}
          collapsed={hideLabels}
          onNavigate={onNavigate}
        />
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, state, role, reset, setAccountSelected } = useDemo();
  const confirmReset = () => {
    if (
      window.confirm(
        "Reset the demo? This clears your verifications, investigations, decisions, uploaded documents and history in this browser.",
      )
    )
      reset();
  };
  useDerived();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const title =
    pathname === "/"
      ? "Dashboard"
      : (PAGE_TITLES.find(([path]) => pathname.startsWith(path))?.[1] ?? "Workspace");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    void navigate({ to: "/documents", search: q ? { q } : {} });
  };

  if (hydrated && !state.accountSelected) return <AccountSelection />;

  return (
    <TourProvider>
      <div className="min-h-screen bg-background">
        {mobileOpen && (
          <button
            className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 hidden border-r border-sidebar-border transition-[width] lg:block",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          <Navigation
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            mobile={false}
            closeMobile={() => setMobileOpen(false)}
          />
        </aside>
        {mobileOpen && (
          <aside className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden">
            <Navigation
              collapsed={false}
              setCollapsed={setCollapsed}
              mobile
              closeMobile={() => setMobileOpen(false)}
            />
          </aside>
        )}

        <div
          className={cn("min-h-screen transition-[padding] lg:pl-64", collapsed && "lg:pl-[72px]")}
        >
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <div className="hidden min-w-0 lg:block">
              <p className="text-[11px] text-muted-foreground">Brightwave Group</p>
              <p className="truncate text-sm font-medium">{title}</p>
            </div>
            <form
              onSubmit={submitSearch}
              className="relative ml-auto w-full max-w-sm"
              role="search"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 bg-background pl-9 pr-3 text-xs"
                placeholder="Search contracts and suppliers"
                aria-label="Search contracts and suppliers"
              />
            </form>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={confirmReset}
              aria-label="Reset demo"
              title="Reset demo: clears your changes and uploads in this browser"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  aria-label="Open demo account menu"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {role.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <span className="hidden xl:block">
                    <span className="block text-xs font-medium">{role.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {role.short} · simulated
                    </span>
                  </span>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block">{role.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {role.title}
                  </span>
                  <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                    Simulated demo account
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setAccountSelected(false)}>
                  <LogOut />
                  Switch Demo Account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    void navigate({ to: "/about" });
                  }}
                >
                  <Settings2 />
                  Project and account information
                </DropdownMenuItem>
                <ThemeToggle />
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={confirmReset}>
                  <RotateCcw />
                  Reset demo data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            {hydrated ? (
              children
            ) : (
              <div className="space-y-3" aria-busy="true">
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                <div className="h-56 animate-pulse rounded bg-muted" />
              </div>
            )}
          </main>
          <footer className="border-t px-4 pb-20 pt-3 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1600px] flex-wrap gap-x-4 gap-y-1">
              <span>
                All data is synthetic. Brightwave Group and BrightHire Staffing are fictional.
              </span>
              <span>Nothing is sent to suppliers.</span>
              <span>Recovery is not tracked.</span>
            </div>
          </footer>
        </div>
      </div>
    </TourProvider>
  );
}
