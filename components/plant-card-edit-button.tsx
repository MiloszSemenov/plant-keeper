"use client";

import { Icon } from "@/components/ui/icon";
import { useRouter } from "next/navigation";

export function PlantCardEditButton({
  plantId,
  nickname,
}: {
  plantId: string;
  nickname: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/plant/${plantId}`); // 👉 NIE zgadujemy /edit
      }}
      className="plant-card-edit"
      aria-label={`Edit ${nickname}`}
    >
      <Icon className="plant-card-edit__icon" name="edit" />
    </button>
  );
}