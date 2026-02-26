import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CuentaContableDetalle, TipoCuenta } from '../../../core/models';
import { CuentaService } from '../../../core/services/cuenta.service';
import { TipoCuentaService } from '../../../core/services/tipo-cuenta.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/components/modal/modal';
import { Combobox, ComboboxOption } from '../../../shared/components/combobox/combobox';

interface CuentaNode {
  cuenta: CuentaContableDetalle;
  children: CuentaNode[];
  depth: number;
}

function calcularNivel(codigo: string): number | null {
  switch (codigo.length) {
    case 1: return 1;
    case 2: return 2;
    case 3: return 3;
    case 5: return 4;
    case 8: return 5;
    default: return null;
  }
}

@Component({
  selector: 'app-cuentas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Combobox],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Cuentas Contables</h2>
        <div style="display: flex; gap: 0.5rem">
          @if (!isFiltering()) {
            <button class="btn btn-secondary btn-sm" (click)="expandirTodo()">Expandir todo</button>
            <button class="btn btn-secondary btn-sm" (click)="colapsarTodo()">Colapsar todo</button>
          }
          <button class="btn btn-primary" (click)="abrirModal()">+ Nueva Cuenta</button>
        </div>
      </div>
      <div class="card-body" style="padding: 1rem; border-bottom: 1px solid var(--color-ucb-gray-200)">
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center">
          <div style="position: relative; flex: 1; min-width: 220px">
            <svg style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--color-ucb-gray-400)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              [value]="busqueda()"
              (input)="setBusqueda($event)"
              style="padding-left: 2rem; width: 100%"
              aria-label="Buscar cuentas"
            />
          </div>
          <app-combobox
            [formControl]="filtroTipoCtrl"
            [options]="tipoFiltroOptions()"
            placeholder="Todos los tipos"
            ariaLabel="Filtrar por tipo"
          />
          <app-combobox
            [formControl]="filtroEstadoCtrl"
            [options]="estadoFiltroOptions"
            placeholder="Todos los estados"
            ariaLabel="Filtrar por estado"
          />
          <app-combobox
            [formControl]="filtroNivelCtrl"
            [options]="nivelFiltroOptions"
            placeholder="Todos los niveles"
            ariaLabel="Filtrar por nivel"
          />
          @if (isFiltering()) {
            <button class="btn btn-secondary btn-sm" (click)="limpiarFiltros()">Limpiar filtros</button>
          }
          <span style="color: var(--color-ucb-gray-500); font-size: 0.85rem; white-space: nowrap">
            {{ visibleRows().length }} / {{ cuentas().length }} cuentas
          </span>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Cuentas contables">
          <thead>
            <tr>
              <th style="min-width: 280px">Código / Cuenta</th>
              <th>Nivel</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visibleRows(); track row.cuenta.id) {
              <tr [style.background]="row.depth === 0 && !isFiltering() ? 'var(--color-ucb-gray-50)' : ''">
                <td>
                  <div style="display: flex; align-items: center" [style.padding-left.rem]="isFiltering() ? 0 : row.depth * 1.5">
                    @if (row.children.length > 0 && !isFiltering()) {
                      <button
                        class="btn-icon"
                        style="padding: 0.125rem; margin-right: 0.25rem"
                        (click)="toggleExpand(row.cuenta.id)"
                        [attr.aria-label]="expandedIds().has(row.cuenta.id) ? 'Colapsar' : 'Expandir'"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          @if (expandedIds().has(row.cuenta.id)) {
                            <polyline points="6 9 12 15 18 9"/>
                          } @else {
                            <polyline points="9 6 15 12 9 18"/>
                          }
                        </svg>
                      </button>
                    } @else {
                      <span style="display: inline-block; width: 22px"></span>
                    }
                    <span>
                      <span style="font-weight: 600; color: var(--color-ucb-primary)">{{ row.cuenta.codigo }}</span>
                      <span style="margin-left: 0.5rem; color: var(--color-ucb-gray-700)"
                            [style.font-weight]="row.cuenta.nivel < 5 ? '600' : '400'">{{ row.cuenta.cuenta }}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <span class="badge badge-primary">{{ row.cuenta.nivel }}</span>
                </td>
                <td>{{ row.cuenta.tipo_cuenta_nombre }}</td>
                <td>
                  <span class="badge" [class.badge-active]="row.cuenta.activo" [class.badge-inactive]="!row.cuenta.activo">
                    {{ row.cuenta.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 0.25rem">
                    <button class="btn btn-sm" (click)="editar(row.cuenta)">Editar</button>
                    <button class="btn btn-sm" (click)="toggleActivo(row.cuenta)">
                      {{ row.cuenta.activo ? 'Desactivar' : 'Activar' }}
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" style="text-align: center; padding: 2rem">{{ isFiltering() ? 'No hay cuentas que coincidan con los filtros.' : 'No hay cuentas registradas.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <app-modal [open]="modalAbierto()" [title]="editandoId() ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'" ariaLabel="Formulario de cuenta contable" (closed)="cerrarModal()">
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="form-group">
            <label>Tipo de Cuenta *</label>
            <app-combobox
              formControlName="id_tipo_cuenta"
              [options]="tipoCuentaOptions()"
              placeholder="Seleccione un tipo"
              ariaLabel="Tipo de cuenta"
            />
          </div>
          <div class="form-group">
            <label for="codigo">Código *</label>
            <input id="codigo" type="text" formControlName="codigo" placeholder="Ej: 51101001" />
            @if (nivelCalculado() !== null) {
              <small style="color: var(--color-ucb-primary); font-weight: 600; margin-top: 0.25rem; display: block">
                Nivel {{ nivelCalculado() }} (longitud {{ form.controls.codigo.value.length }})
              </small>
            }
            @if (form.controls.codigo.value && nivelCalculado() === null) {
              <small class="form-error">
                Longitud de código inválida ({{ form.controls.codigo.value.length }}). Longitudes válidas: 1, 2, 3, 5 u 8 caracteres.
              </small>
            }
          </div>
          <div class="form-group">
            <label>Cuenta Padre</label>
            @if (nivelCalculado() !== null && nivelCalculado()! > 1) {
              <app-combobox
                formControlName="id_cuenta_padre"
                [options]="cuentaPadreOptions()"
                placeholder="Sin cuenta padre"
                ariaLabel="Cuenta padre"
              />
              @if (cuentaPadreOptions().length === 0) {
                <small class="form-error">No hay cuentas de nivel inferior disponibles como padre.</small>
              }
            } @else {
              <small style="color: var(--color-ucb-gray-500); display: block; margin-top: 0.25rem">
                {{ nivelCalculado() === 1 ? 'Las cuentas de nivel 1 no llevan cuenta padre.' : 'Ingrese un código válido primero.' }}
              </small>
            }
          </div>
          <div class="form-group">
            <label for="cuenta">Nombre de Cuenta *</label>
            <input id="cuenta" type="text" formControlName="cuenta" />
          </div>
        </form>
        <div modalFooter class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="cerrarModal()">Cancelar</button>
          <button type="button" class="btn btn-primary" [disabled]="!canSave()" (click)="guardar()">
            {{ guardando() ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: ``,
})
export class Cuentas implements OnInit {
  private readonly svc = inject(CuentaService);
  private readonly tipoCuentaSvc = inject(TipoCuentaService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly cuentas = signal<CuentaContableDetalle[]>([]);
  protected readonly tiposCuenta = signal<TipoCuenta[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly expandedIds = signal<Set<string>>(new Set());
  protected readonly nivelCalculado = signal<number | null>(null);
  protected readonly busqueda = signal('');
  protected readonly filtroTipoCtrl = new FormControl<string | null>(null);
  protected readonly filtroEstadoCtrl = new FormControl<string | null>(null);
  protected readonly filtroNivelCtrl = new FormControl<number | null>(null);
  protected readonly filtroTipo = toSignal(this.filtroTipoCtrl.valueChanges, { initialValue: null });
  protected readonly filtroEstado = toSignal(this.filtroEstadoCtrl.valueChanges, { initialValue: null });
  protected readonly filtroNivel = toSignal(this.filtroNivelCtrl.valueChanges, { initialValue: null });

  protected readonly isFiltering = computed(() =>
    !!this.busqueda().trim() || !!this.filtroTipo() || !!this.filtroEstado() || this.filtroNivel() !== null
  );

  protected readonly tipoFiltroOptions = computed<ComboboxOption[]>(() =>
    this.tiposCuenta().map(t => ({ value: t.id, label: t.tipo }))
  );

  protected readonly estadoFiltroOptions: ComboboxOption[] = [
    { value: 'activos', label: 'Solo activos' },
    { value: 'inactivos', label: 'Solo inactivos' },
  ];

  protected readonly nivelFiltroOptions: ComboboxOption[] = [
    { value: 1, label: 'Nivel 1' },
    { value: 2, label: 'Nivel 2' },
    { value: 3, label: 'Nivel 3' },
    { value: 4, label: 'Nivel 4' },
    { value: 5, label: 'Nivel 5 (hoja)' },
  ];

  protected readonly tipoCuentaOptions = computed<ComboboxOption[]>(() =>
    this.tiposCuenta().map(t => ({ value: t.id, label: t.tipo }))
  );

  // Filter parent options based on computed nivel: only show accounts with nivel < calculated
  protected readonly cuentaPadreOptions = computed<ComboboxOption[]>(() => {
    const nivel = this.nivelCalculado();
    if (nivel === null || nivel <= 1) return [];
    const editId = this.editandoId();
    return this.cuentas()
      .filter(c => c.activo && c.nivel < nivel && c.id !== editId)
      .map(c => ({ value: c.id, label: `${c.codigo} — ${c.cuenta} (N${c.nivel})` }));
  });

  protected readonly form = this.fb.nonNullable.group({
    id_tipo_cuenta: ['', Validators.required],
    id_cuenta_padre: [''],
    codigo: ['', Validators.required],
    cuenta: ['', Validators.required],
  });

  protected readonly canSave = computed(() => {
    const nivel = this.nivelCalculado();
    return this.form.valid && nivel !== null && !this.guardando();
  });

  // Build tree structure from flat list
  private readonly treeRoots = computed<CuentaNode[]>(() => {
    const all = this.cuentas();
    const map = new Map<string, CuentaNode>();
    for (const c of all) {
      map.set(c.id, { cuenta: c, children: [], depth: 0 });
    }
    const roots: CuentaNode[] = [];
    for (const node of map.values()) {
      const parentId = node.cuenta.id_cuenta_padre;
      if (parentId && map.has(parentId)) {
        map.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // Set depths
    const setDepth = (nodes: CuentaNode[], depth: number) => {
      for (const n of nodes) {
        n.depth = depth;
        setDepth(n.children, depth + 1);
      }
    };
    setDepth(roots, 0);
    return roots;
  });

  // Flatten tree respecting expanded state
  protected readonly visibleRows = computed<CuentaNode[]>(() => {
    const filtering = this.isFiltering();
    if (filtering) {
      // Flat filtered list
      const q = this.busqueda().toLowerCase().trim();
      const tipo = this.filtroTipo();
      const estado = this.filtroEstado();
      const nivel = this.filtroNivel();
      return this.cuentas()
        .filter(c => {
          if (tipo && c.id_tipo_cuenta !== tipo) return false;
          if (estado === 'activos' && !c.activo) return false;
          if (estado === 'inactivos' && c.activo) return false;
          if (nivel !== null && c.nivel !== nivel) return false;
          if (q && !c.codigo.toLowerCase().includes(q) && !c.cuenta.toLowerCase().includes(q)) return false;
          return true;
        })
        .map(c => ({ cuenta: c, children: [], depth: 0 }));
    }
    // Tree mode
    const expanded = this.expandedIds();
    const result: CuentaNode[] = [];
    const walk = (nodes: CuentaNode[]) => {
      for (const n of nodes) {
        result.push(n);
        if (n.children.length > 0 && expanded.has(n.cuenta.id)) {
          walk(n.children);
        }
      }
    };
    walk(this.treeRoots());
    return result;
  });

  constructor() {
    // Watch codigo changes and recalculate nivel
    effect(() => {
      // This triggers on form setup too, which is fine
      const codigo = this.form.controls.codigo.value;
      this.nivelCalculado.set(calcularNivel(codigo));
    });
  }

  async ngOnInit(): Promise<void> {
    // Listen to codigo field changes to recalculate nivel
    this.form.controls.codigo.valueChanges.subscribe(val => {
      const nivel = calcularNivel(val);
      this.nivelCalculado.set(nivel);
      // If nivel is 1, clear parent
      if (nivel === 1) {
        this.form.controls.id_cuenta_padre.setValue('');
      }
    });
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const [cuentas, tipos] = await Promise.all([
        this.svc.listar(),
        this.tipoCuentaSvc.listar(),
      ]);
      this.cuentas.set(cuentas);
      this.tiposCuenta.set(tipos.filter((t) => t.activo));
      // Auto-expand first two levels by default
      const ids = new Set<string>();
      for (const c of cuentas) {
        if (c.nivel <= 2) ids.add(c.id);
      }
      this.expandedIds.set(ids);
    } catch {
      this.toast.error('Error al cargar cuentas');
    }
  }

  protected setBusqueda(e: Event): void {
    this.busqueda.set((e.target as HTMLInputElement).value);
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroTipoCtrl.setValue(null);
    this.filtroEstadoCtrl.setValue(null);
    this.filtroNivelCtrl.setValue(null);
  }

  protected toggleExpand(id: string): void {
    const current = new Set(this.expandedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedIds.set(current);
  }

  protected expandirTodo(): void {
    const ids = new Set<string>();
    for (const c of this.cuentas()) {
      ids.add(c.id);
    }
    this.expandedIds.set(ids);
  }

  protected colapsarTodo(): void {
    this.expandedIds.set(new Set());
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ id_tipo_cuenta: '', id_cuenta_padre: '', codigo: '', cuenta: '' });
    this.nivelCalculado.set(null);
    this.modalAbierto.set(true);
  }

  protected editar(c: CuentaContableDetalle): void {
    this.editandoId.set(c.id);
    this.nivelCalculado.set(c.nivel);
    this.form.patchValue({
      id_tipo_cuenta: c.id_tipo_cuenta,
      id_cuenta_padre: c.id_cuenta_padre ?? '',
      codigo: c.codigo,
      cuenta: c.cuenta,
    });
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid || this.nivelCalculado() === null) return;
    this.guardando.set(true);
    const val = this.form.getRawValue();
    try {
      const payload = {
        ...val,
        id_cuenta_padre: val.id_cuenta_padre || null,
      };
      if (this.editandoId()) {
        await this.svc.editar(this.editandoId()!, payload);
        this.toast.success('Cuenta actualizada');
      } else {
        await this.svc.crear(payload);
        this.toast.success('Cuenta creada');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(c: CuentaContableDetalle): Promise<void> {
    try {
      await this.svc.editar(c.id, { activo: !c.activo });
      this.toast.success(c.activo ? 'Cuenta desactivada' : 'Cuenta activada');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
