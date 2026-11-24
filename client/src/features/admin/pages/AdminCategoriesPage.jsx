import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { IconBubble } from '../../../components/ui/IconBubble.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { categoryIcon, CATEGORY_ICON_KEYS } from '../../../lib/categoryIcons.js';
import { cn } from '../../../lib/cn.js';
import {
  categoriesApi,
  buildCategoryTree,
  categoryName,
  useCategories,
} from '../../categories/api.js';

const emptyForm = { en: '', te: '', icon: '', sortOrder: '' };

/**
 * /admin/categories - manage business main categories and subcategories.
 * Categories are never deleted (businesses may reference them): deactivate instead.
 */
export default function AdminCategoriesPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isPending, isError, error, refetch } = useCategories('business', {
    includeInactive: true,
  });
  const tree = buildCategoryTree(data ?? []);
  const [editor, setEditor] = useState(null); // { mode: 'create'|'edit', parent?, category?, form }
  const [formError, setFormError] = useState({});

  const done = async (msg) => {
    await qc.invalidateQueries({ queryKey: ['categories'] });
    toast.success(msg);
  };
  const onError = (err) => {
    setFormError(err.fieldErrors ?? {});
    toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
  };

  const save = useMutation({
    mutationFn: async ({ mode, parent, category, form }) => {
      const body = {
        name: { en: form.en.trim(), ...(form.te.trim() ? { te: form.te.trim() } : {}) },
        ...(form.icon ? { icon: form.icon } : mode === 'edit' ? { icon: null } : {}),
        ...(form.sortOrder !== '' ? { sortOrder: Number(form.sortOrder) } : {}),
      };
      if (mode === 'create')
        return categoriesApi.create({
          ...body,
          type: 'business',
          ...(parent ? { parentId: parent.id } : {}),
        });
      return categoriesApi.update(category.id, body);
    },
    onSuccess: async () => {
      setEditor(null);
      await done(t('form.saved'));
    },
    onError,
  });

  const toggle = useMutation({
    mutationFn: (c) => categoriesApi.update(c.id, { isActive: !c.isActive }),
    onSuccess: (c) =>
      done(c.isActive ? t('categoriesAdmin.activated') : t('categoriesAdmin.deactivated')),
    onError,
  });

  const openCreate = (parent) => {
    setFormError({});
    setEditor({ mode: 'create', parent, form: { ...emptyForm } });
  };
  const openEdit = (category) => {
    setFormError({});
    setEditor({
      mode: 'edit',
      category,
      form: {
        en: category.name.en,
        te: category.name.te ?? '',
        icon: category.icon ?? '',
        sortOrder: String(category.sortOrder ?? ''),
      },
    });
  };
  const setForm = (patch) => setEditor((e) => ({ ...e, form: { ...e.form, ...patch } }));

  const renderRow = (c, sub = false) => {
    const Icon = categoryIcon(c.icon);
    return (
      <div
        className={cn('flex items-center gap-2 py-2', sub && 'pl-3', !c.isActive && 'opacity-60')}
      >
        {sub ? (
          <Icon className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        ) : (
          <IconBubble icon={Icon} size="sm" round tone={c.isActive ? 'green' : 'gray'} />
        )}
        <span className="min-w-0 flex-1">
          <span className={cn('line-clamp-2 leading-snug', sub ? 'text-[14px]' : 'font-bold')}>
            {categoryName(c, i18n.language)}
          </span>
          <span className="block truncate text-[11px] text-ink-soft">
            {t('categoriesAdmin.order', { n: c.sortOrder })}
            {!c.isActive && ` • ${t('categoriesAdmin.inactive')}`}
          </span>
        </span>
        <button
          type="button"
          onClick={() => openEdit(c)}
          aria-label={`${t('business.edit')} ${c.name.en}`}
          className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-brand-50"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => toggle.mutate(c)}
          aria-label={`${c.isActive ? t('categoriesAdmin.deactivate') : t('categoriesAdmin.activate')} ${c.name.en}`}
          className="min-h-tap shrink-0 rounded-full px-2.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50"
        >
          {c.isActive ? t('categoriesAdmin.deactivate') : t('categoriesAdmin.activate')}
        </button>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t('categoriesAdmin.title')}
        actions={
          <button
            type="button"
            onClick={() => openCreate(null)}
            aria-label={t('categoriesAdmin.newMain')}
            className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-muted">
          {t('categoriesAdmin.note')}
        </p>
        {isPending ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : tree.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title={t('categoriesAdmin.emptyTitle')}
            body={t('categoriesAdmin.emptyBody')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {tree.map((main) => (
              <li
                key={main.id}
                className="rounded-card bg-white px-3 py-1 shadow-card ring-1 ring-brand-100"
              >
                {renderRow(main)}
                <ul className="border-t border-brand-50">
                  {main.children.map((sub) => (
                    <li key={sub.id}>{renderRow(sub, true)}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => openCreate(main)}
                  className="mb-2 ml-6 inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> {t('categoriesAdmin.newSub')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={
          editor?.mode === 'edit'
            ? t('categoriesAdmin.edit')
            : editor?.parent
              ? t('categoriesAdmin.newSubIn', { name: editor.parent.name.en })
              : t('categoriesAdmin.newMain')
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={save.isPending}
              disabled={!editor?.form.en.trim()}
              onClick={() => save.mutate(editor)}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editor && (
          <div className="flex flex-col gap-4">
            <Input
              label={t('categoriesAdmin.nameEn')}
              maxLength={80}
              value={editor.form.en}
              error={formError['name.en'] ?? formError.slug}
              onChange={(e) => setForm({ en: e.target.value })}
            />
            <Input
              label={t('categoriesAdmin.nameTe')}
              maxLength={80}
              lang="te"
              value={editor.form.te}
              onChange={(e) => setForm({ te: e.target.value })}
            />
            <Input
              as="select"
              label={t('categoriesAdmin.icon')}
              value={editor.form.icon}
              onChange={(e) => setForm({ icon: e.target.value })}
            >
              <option value="">—</option>
              {CATEGORY_ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Input>
            <Input
              label={t('categoriesAdmin.sortOrder')}
              type="number"
              min={0}
              value={editor.form.sortOrder}
              hint={t('categoriesAdmin.sortHint')}
              onChange={(e) => setForm({ sortOrder: e.target.value })}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
