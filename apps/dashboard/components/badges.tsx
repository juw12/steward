import { Badge } from '@/components/ui/badge';
import type { GuardCategory, GuardAction } from '@/lib/types';
import { cn } from '@/lib/utils';

const categoryStyles: Record<GuardCategory, string> = {
  on_mission: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  off_task_curious: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  off_task_abuse: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  hostile_injection: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

const categoryLabels: Record<GuardCategory, string> = {
  on_mission: 'On Mission',
  off_task_curious: 'Off-Task (Curious)',
  off_task_abuse: 'Off-Task (Abuse)',
  hostile_injection: 'Hostile',
};

const actionStyles: Record<GuardAction, string> = {
  allow: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  redirect: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  block: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

export function CategoryBadge({ category }: { category: GuardCategory }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', categoryStyles[category])}
    >
      {categoryLabels[category]}
    </Badge>
  );
}

export function ActionBadge({ action }: { action: GuardAction }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium capitalize',
        actionStyles[action]
      )}
    >
      {action}
    </Badge>
  );
}
