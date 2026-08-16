import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-80" />
        <h1 className="text-3xl font-semibold tracking-tight">
          404 - Not Found
        </h1>
        <p className="text-muted-foreground mt-2 mb-6">
          The page or resource you are looking for does not exist in this
          workspace.
        </p>
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
