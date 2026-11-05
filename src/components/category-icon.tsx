import {
  Armchair, Baby, Bike, BookOpen, Car, Dumbbell, Laptop, type LucideIcon, Package, Shirt, Smartphone, Tv, Wrench, Home, Gamepad2, Watch,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone, laptop: Laptop, tv: Tv, armchair: Armchair, shirt: Shirt, car: Car, bike: Bike, baby: Baby,
  book: BookOpen, dumbbell: Dumbbell, wrench: Wrench, home: Home, gamepad: Gamepad2, watch: Watch, package: Package,
};
export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Package;
  return <Icon className={className} aria-hidden />;
}
