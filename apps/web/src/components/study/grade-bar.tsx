"use client";

import { Button } from "@/components/ui/button";
import type { ReviewGrade } from "@learn-chinese/shared";

const GRADES: {
  grade: ReviewGrade;
  label: string;
  variant: "destructive" | "secondary" | "default" | "outline";
}[] = [
  { grade: 1, label: "Again", variant: "destructive" },
  { grade: 2, label: "Hard", variant: "secondary" },
  { grade: 3, label: "Good", variant: "default" },
  { grade: 4, label: "Easy", variant: "outline" },
];

export function GradeBar({
  onGrade,
  disabled,
}: {
  onGrade: (grade: ReviewGrade) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map(({ grade, label, variant }) => (
        <Button
          key={grade}
          variant={variant}
          disabled={disabled}
          onClick={() => onGrade(grade)}
          className="h-12"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
