import OrganizePageCard from "@/components/pdf/OrganizePageCard";

export type OrganizePageItem = {
  id: string;
  originalPageIndex: number;
  pageNumber: number;
  dataUrl: string;
  rotation: number;
};

type PageGridProps = {
  pages: OrganizePageItem[];
  selectedPageIds: string[];
  onToggleSelect: (pageId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRotate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
};

export default function PageGrid({
  pages,
  selectedPageIds,
  onToggleSelect,
  onMoveUp,
  onMoveDown,
  onRotate,
  onDelete,
}: PageGridProps) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {pages.map((page, index) => (
        <OrganizePageCard
          key={page.id}
          pageNumber={index + 1}
          dataUrl={page.dataUrl}
          rotation={page.rotation}
          isSelected={selectedPageIds.includes(page.id)}
          isFirst={index === 0}
          isLast={index === pages.length - 1}
          onToggleSelect={() => onToggleSelect(page.id)}
          onMoveUp={() => onMoveUp(index)}
          onMoveDown={() => onMoveDown(index)}
          onRotate={() => onRotate(page.id)}
          onDelete={() => onDelete(page.id)}
        />
      ))}
    </div>
  );
}