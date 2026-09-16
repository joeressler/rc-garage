import { WorkbenchPlaceholder } from '../components/workbench/WorkbenchPlaceholder';

export function FeedPlaceholderView() {
  return (
    <WorkbenchPlaceholder
      drawer="03"
      title="Community Feed"
      milestone="Milestone 12"
      summary="Public setup discovery, likes, and the fork diff inspector stay on the community workbench milestone. The NestJS feed API is already live behind this drawer."
    />
  );
}
