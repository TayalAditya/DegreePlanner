import Image from "next/image";

type BrandMarkProps = {
  size?: "sm" | "md";
  className?: string;
  priority?: boolean;
};

export function BrandMark({ size = "md", className = "", priority = false }: BrandMarkProps) {
  const zoomScale = 1.5;
  const boxSize = size === "sm" ? 32 : 36;
  const wrapperSizeClass = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const imageTransformClass = size === "sm"
    ? "scale-[1.5] translate-y-[4px]"
    : "scale-[1.5] translate-y-[5px]";
  const effectiveSize = Math.round(boxSize * zoomScale);

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/10 shadow-sm ${wrapperSizeClass} ${className}`}
    >
      <Image
        src="/logo.jpg"
        alt=""
        width={effectiveSize}
        height={effectiveSize}
        priority={priority}
        quality={100}
        sizes={`${effectiveSize}px`}
        className={`h-full w-full object-cover ${imageTransformClass}`}
      />
    </span>
  );
}
