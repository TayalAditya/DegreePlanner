import Image from "next/image";

type BrandMarkProps = {
  size?: "sm" | "md";
  className?: string;
  priority?: boolean;
};

export function BrandMark({ size = "md", className = "", priority = false }: BrandMarkProps) {
  const boxSize = size === "sm" ? 32 : 36;
  const wrapperSizeClass = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const cropScale = 1.5;
  const cropSize = Math.round(boxSize * cropScale);

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/10 shadow-sm ${wrapperSizeClass} ${className}`}
    >
      <span className="relative block h-full w-[150%]">
        <Image
          src="/logo.jpg"
          alt=""
          fill
          priority={priority}
          quality={100}
          sizes={`${cropSize}px`}
          className="object-cover object-[center_20%]"
        />
      </span>
    </span>
  );
}
