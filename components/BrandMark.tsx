import Image from "next/image";

type BrandMarkProps = {
  size?: "sm" | "md";
  className?: string;
  priority?: boolean;
};

export function BrandMark({ size = "md", className = "", priority = false }: BrandMarkProps) {
  const imageSize = size === "sm" ? 28 : 32;
  const wrapperSizeClass = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-black/10 shadow-sm ${wrapperSizeClass} ${className}`}>
      <Image
        src="/logo.jpg"
        alt=""
        width={imageSize}
        height={imageSize}
        priority={priority}
        className="rounded-lg"
      />
    </span>
  );
}
