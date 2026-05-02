export type Task = {
  id: string;
  rawInput: string;
  title: string;
  priority: string;
  category: string;
  estimatedHours: number | null;
  spentHours: number | null;
  deadline: string | null;
  description: string | null;
  done: boolean;
  createdAt: string;
};
