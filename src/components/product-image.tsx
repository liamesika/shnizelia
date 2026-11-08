import Image from "next/image";

/** Local raster images go through next/image (resized/WebP for mobile). SVG placeholders and external URLs render directly. */
export function ProductImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const optimizable = src.startsWith("/") && !src.endsWith(".svg");
  if (optimizable) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 640px) 380px, 100vw"
        priority={priority}
        className="object-cover"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="absolute inset-0 size-full object-cover"
    />
  );
}
