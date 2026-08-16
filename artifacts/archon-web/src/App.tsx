import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ProjectNew from "@/pages/project-new";
import ProjectWorkspace from "@/pages/project-workspace";
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
  Link,
} from "wouter";
import { Cpu } from "lucide-react";

const queryClient = new QueryClient();

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <header className="h-14 border-b border-border bg-card flex items-center px-6 shrink-0 z-10 sticky top-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-primary font-bold tracking-tight hover:opacity-80 transition-opacity"
        >
          <Cpu className="w-5 h-5" />
          <span className="text-lg">ARCHON</span>
        </Link>
        <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <span className="font-mono text-xs px-2 py-1 rounded bg-muted/50 border border-border">
            V0.1.0
          </span>
          <span>Mission Control</span>
        </div>
      </header>
      <main className="flex-1 flex flex-col relative">{children}</main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/projects/new" component={ProjectNew} />
          <Route path="/projects/:id" component={ProjectWorkspace} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
