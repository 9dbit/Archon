import { useProjects } from "@/hooks/use-projects";
import { Link } from "wouter";
import { Plus, ArrowRight, Building2, Calendar, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: projects, isLoading, error } = useProjects();

  return (
    <div className="max-w-6xl mx-auto w-full p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Governed workspace for AI-assisted building design.
          </p>
        </div>
        <Link href="/projects/new">
          <Button className="gap-2 font-medium">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col h-full bg-card/50">
              <CardHeader>
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg flex items-center gap-4">
          <HardHat className="w-8 h-8 opacity-80" />
          <div>
            <h3 className="font-semibold">Failed to load projects</h3>
            <p className="text-sm opacity-80">
              Check the network connection or server status.
            </p>
          </div>
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-24 px-6 border-2 border-dashed border-border rounded-xl bg-card/50">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-medium text-foreground mb-2">
            No projects yet
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Create a new architectural project to start collaborating with the
            AI deterministic engine.
          </p>
          <Link href="/projects/new">
            <Button variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Initialize Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project: any) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block group"
            >
              <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 bg-card cursor-pointer group-hover:-translate-y-1">
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs whitespace-nowrap bg-background"
                    >
                      {project.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 mt-2">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{project.buildingType}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  {project.locationText && (
                    <div className="text-sm text-muted-foreground mb-4">
                      {project.locationText}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap mt-auto">
                    {project.status === "ACTIVE" && (
                      <Badge
                        variant="default"
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-border/50 text-xs text-muted-foreground flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 font-medium text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
