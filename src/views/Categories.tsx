import { useState } from 'react';
import { useData } from '../store/DataContext';
import { EmptyState } from '../components/ui';
import type { Category, CategoryGroup, TxType } from '../types';
import { uid } from '../lib/format';

const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#10b981', '#06b6d4',
  '#6366f1', '#84cc16', '#eab308', '#f43f5e', '#8b5cf6',
];
const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

export default function Categories() {
  const {
    categories,
    groups,
    saveCategory,
    removeCategory,
    saveGroup,
    removeGroup,
    transactions,
  } = useData();

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TxType>('expense');
  const [newGroupName, setNewGroupName] = useState('');

  const expenseGroups = groups.filter((g) => g.type === 'expense');
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');
  const ungrouped = expenseCats.filter((c) => !c.groupId);

  function addCategory() {
    if (!newCatName.trim()) return;
    saveCategory({
      id: uid(),
      name: newCatName.trim(),
      color: randomColor(),
      type: newCatType,
      budget: 0,
      groupId: null,
    });
    setNewCatName('');
  }

  function addGroup() {
    if (!newGroupName.trim()) return;
    saveGroup({
      id: uid(),
      name: newGroupName.trim(),
      color: randomColor(),
      type: 'expense',
      budget: 0,
    });
    setNewGroupName('');
  }

  function onDeleteCategory(c: Category) {
    const used = transactions.some((t) => t.categoryId === c.id);
    const msg = used
      ? `La categoria "${c.name}" è usata da alcuni movimenti, che resteranno senza categoria. Eliminare comunque?`
      : `Eliminare la categoria "${c.name}"?`;
    if (window.confirm(msg)) removeCategory(c.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Categorie & Budget</h2>
        <p className="mt-1 text-sm text-slate-500">
          Raggruppa le categorie in <strong>macro-categorie</strong> e imposta il
          <strong> budget mensile sul gruppo</strong>. Esempio: metti “Generi alimentari”,
          “Ristoranti” e “Bar” nel gruppo <em>Cibo</em> e dai un budget al gruppo.
        </p>
      </div>

      {/* Aggiunte rapide */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 font-semibold text-slate-700">Nuovo gruppo (macro)</h3>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Es. Cibo, Casa, Trasporti…"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGroup()}
            />
            <button className="btn-primary whitespace-nowrap" onClick={addGroup}>
              + Gruppo
            </button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-2 font-semibold text-slate-700">Nuova categoria</h3>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1"
              placeholder="Nome categoria"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <select
              className="input w-auto"
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value as TxType)}
            >
              <option value="expense">Spesa</option>
              <option value="income">Entrata</option>
            </select>
            <button className="btn-secondary whitespace-nowrap" onClick={addCategory}>
              + Categoria
            </button>
          </div>
        </div>
      </div>

      {/* Gruppi con budget */}
      <div>
        <h3 className="mb-2 font-semibold text-slate-700">Gruppi di spesa e budget</h3>
        {expenseGroups.length === 0 ? (
          <EmptyState
            title="Nessun gruppo ancora."
            hint="Crea un gruppo qui sopra, poi trascina dentro le categorie e imposta il budget."
          />
        ) : (
          <div className="space-y-3">
            {expenseGroups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                members={expenseCats.filter((c) => c.groupId === g.id)}
                ungrouped={ungrouped}
                onSaveGroup={saveGroup}
                onDeleteGroup={() =>
                  window.confirm(
                    `Eliminare il gruppo "${g.name}"? Le categorie al suo interno restano, ma senza gruppo e senza budget.`,
                  ) && removeGroup(g.id)
                }
                onSaveCategory={saveCategory}
              />
            ))}
          </div>
        )}
      </div>

      {/* Categorie di spesa senza gruppo */}
      {ungrouped.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-700">
            Categorie di spesa senza gruppo
          </h3>
          <div className="card divide-y divide-slate-100">
            {ungrouped.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                groups={expenseGroups}
                onSave={saveCategory}
                onDelete={() => onDeleteCategory(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Entrate */}
      {incomeCats.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-700">Categorie di entrata</h3>
          <div className="card divide-y divide-slate-100">
            {incomeCats.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                groups={[]}
                onSave={saveCategory}
                onDelete={() => onDeleteCategory(c)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  members,
  ungrouped,
  onSaveGroup,
  onDeleteGroup,
  onSaveCategory,
}: {
  group: CategoryGroup;
  members: Category[];
  ungrouped: Category[];
  onSaveGroup: (g: CategoryGroup) => void;
  onDeleteGroup: () => void;
  onSaveCategory: (c: Category) => void;
}) {
  return (
    <div className="card p-4">
      {/* Riga 1: colore + nome (largo e leggibile) + elimina */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-200 bg-white"
          value={group.color}
          onChange={(e) => onSaveGroup({ ...group, color: e.target.value })}
          title="Colore del gruppo"
        />
        <input
          className="input min-w-0 flex-1 font-semibold"
          value={group.name}
          onChange={(e) => onSaveGroup({ ...group, name: e.target.value })}
          placeholder="Nome gruppo"
        />
        <button
          className="btn-ghost shrink-0 !px-2 !py-1 text-red-500"
          onClick={onDeleteGroup}
          title="Elimina gruppo"
        >
          🗑️
        </button>
      </div>

      {/* Riga 2: budget */}
      <label className="mt-2 flex items-center gap-2 text-sm text-slate-500">
        <span className="w-16">Budget</span>
        <input
          className="input w-32"
          type="number"
          min="0"
          step="10"
          placeholder="0"
          value={group.budget || ''}
          onChange={(e) => onSaveGroup({ ...group, budget: Number(e.target.value) || 0 })}
        />
        <span className="text-xs text-slate-400">€ / mese</span>
      </label>

      {/* Micro-categorie del gruppo */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {members.length === 0 && (
          <span className="text-xs text-slate-400">
            Nessuna categoria in questo gruppo.
          </span>
        )}
        {members.map((c) => (
          <span
            key={c.id}
            className="badge bg-slate-100 text-slate-700"
            style={{ borderLeft: `3px solid ${c.color}` }}
          >
            {c.name}
            <button
              className="ml-1 text-slate-400 hover:text-red-500"
              onClick={() => onSaveCategory({ ...c, groupId: null })}
              title="Togli dal gruppo"
            >
              ✕
            </button>
          </span>
        ))}

        {ungrouped.length > 0 && (
          <select
            className="input !w-auto !py-1 !text-xs"
            value=""
            onChange={(e) => {
              const cat = ungrouped.find((c) => c.id === e.target.value);
              if (cat) onSaveCategory({ ...cat, groupId: group.id });
            }}
          >
            <option value="">+ Aggiungi categoria…</option>
            {ungrouped.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  groups,
  onSave,
  onDelete,
}: {
  category: Category;
  groups: CategoryGroup[];
  onSave: (c: Category) => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-3">
      {/* Riga 1: colore + nome (largo e leggibile) + elimina */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-white"
          value={category.color}
          onChange={(e) => onSave({ ...category, color: e.target.value })}
          title="Colore"
        />
        <input
          className="input min-w-0 flex-1"
          value={category.name}
          onChange={(e) => onSave({ ...category, name: e.target.value })}
          placeholder="Nome categoria"
        />
        <button
          className="btn-ghost shrink-0 !px-2 !py-1 text-red-500"
          onClick={onDelete}
          title="Elimina categoria"
        >
          🗑️
        </button>
      </div>

      {/* Riga 2: assegnazione al gruppo */}
      {groups.length > 0 && (
        <div className="mt-2 flex items-center gap-2 pl-10">
          <span className="shrink-0 text-xs text-slate-400">Gruppo</span>
          <select
            className="input flex-1 text-sm"
            value={category.groupId ?? ''}
            onChange={(e) => onSave({ ...category, groupId: e.target.value || null })}
          >
            <option value="">— nessun gruppo —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
