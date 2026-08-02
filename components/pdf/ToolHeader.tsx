type ToolHeaderProps = {
  label: string;
  title: string;
  description: string;
};

export default function ToolHeader({
  label,
  title,
  description,
}: ToolHeaderProps) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
        {label}
      </p>

      <h1 className="mt-3 text-4xl font-extrabold text-gray-900 md:text-6xl">
        {title}
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">
        {description}
      </p>
    </div>
  );
}