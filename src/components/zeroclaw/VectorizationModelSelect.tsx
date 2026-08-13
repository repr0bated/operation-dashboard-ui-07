/**
 * Vectorization model picker — Embedding Pipeline's routing authority.
 */
import { AssignmentModelSelect } from "@/components/zeroclaw/AssignmentModelSelect";

interface Props {
  className?: string;
}

export function VectorizationModelSelect({ className }: Props) {
  return <AssignmentModelSelect role="vectorization" className={className} />;
}
