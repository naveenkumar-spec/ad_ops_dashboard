export default function SortableHeader({ field, children, sortField, sortDirection, onSort }) {
  const isActive = sortField === field;
  const icon = isActive ? (sortDirection === "asc" ? "▲" : "▼") : "⇅";
  return (
    <th
      className="sortable-header"
      onClick={() => onSort(field)}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      <div className="header-content">
        <span>{children}</span>
        <span className={`sort-icon ${isActive ? "active" : "inactive"}`}>{icon}</span>
      </div>
    </th>
  );
}
