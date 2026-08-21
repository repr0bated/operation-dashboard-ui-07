import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Puzzle, ExternalLink } from "lucide-react";

const INTEGRATIONS = [
  { name: "GitHub", category: "Development", installed: false },
  { name: "GitLab", category: "Development", installed: false },
  { name: "Jira", category: "Project Management", installed: false },
  { name: "Notion", category: "Productivity", installed: false },
  { name: "Google Calendar", category: "Productivity", installed: false },
  { name: "Slack", category: "Communication", installed: false },
  { name: "Discord", category: "Communication", installed: false },
  { name: "Gmail", category: "Email", installed: false },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Browse and install 50+ integrations for 3tched Router
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.name} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">{integration.name}</h3>
                <p className="text-xs text-muted-foreground">{integration.category}</p>
              </div>
              <Badge variant={integration.installed ? "default" : "secondary"}>
                {integration.installed ? "Installed" : "Available"}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              <Puzzle className="h-4 w-4 mr-2" />
              {integration.installed ? "Configure" : "Install"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
