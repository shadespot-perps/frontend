import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageShell
      title="Page not found"
      subtitle={
        <span className="font-mono text-[11px] text-muted-foreground">
          {location.pathname}
        </span>
      }
      width="lg"
    >
      <div className="shade-card p-8 sm:p-10">
        <div className="mx-auto max-w-md text-center space-y-4">
          <p className="font-display text-6xl font-semibold tracking-tight text-foreground/90">404</p>
          <p className="text-sm text-muted-foreground">
            This route doesn’t exist yet. Use navigation, or go back to the app.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Button asChild>
              <Link to="/trade">Go to Trade</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Landing</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default NotFound;
