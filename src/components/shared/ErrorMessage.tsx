import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorMessageProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export function ErrorMessage({
  title = "Erro ao carregar dados",
  message,
  retry
}: ErrorMessageProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="mt-2">
          {message}
        </AlertDescription>
        {retry && (
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            className="mt-4"
          >
            Tentar novamente
          </Button>
        )}
      </Alert>
    </div>
  );
}
