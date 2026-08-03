type SectionTitleProps = {
  title: string;
  description?: string;
};

export default function SectionTitle({
  title,
  description,
}: SectionTitleProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}