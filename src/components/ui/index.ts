/**
 * PROBATIO — UI Component Library
 *
 * Barrel export for all primitive UI components.
 * Built from scratch — no shadcn dependency.
 */

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./button";
export { Input, type InputProps } from "./input";
export { Badge, type BadgeProps, type BadgeVariant } from "./badge";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
  type CardHeaderProps,
  type CardTitleProps,
  type CardDescriptionProps,
  type CardContentProps,
  type CardFooterProps,
} from "./card";
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  type DialogProps,
  type DialogTriggerProps,
  type DialogContentProps,
  type DialogCloseProps,
  type DialogHeaderProps,
  type DialogTitleProps,
  type DialogDescriptionProps,
  type DialogFooterProps,
} from "./dialog";
export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  type DropdownProps,
  type DropdownTriggerProps,
  type DropdownContentProps,
  type DropdownItemProps,
  type DropdownLabelProps,
  type DropdownSeparatorProps,
} from "./dropdown";
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
} from "./tabs";
export { Tooltip, type TooltipProps, type TooltipSide } from "./tooltip";
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonChart,
  type SkeletonProps,
  type SkeletonTextProps,
  type SkeletonCardProps,
  type SkeletonAvatarProps,
  type SkeletonChartProps,
} from "./skeleton";
export { Progress, type ProgressProps, type ProgressSize, type ProgressColor } from "./progress";
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionContentProps,
} from "./accordion";
export { FileUpload, type FileUploadProps, type FileUploadResult } from "./file-upload";
