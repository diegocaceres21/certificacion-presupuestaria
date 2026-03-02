import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  UnidadConDependencia,
  CuentaContableDetalle,
  Proyecto,
  CertificacionDetalle,
} from '../../../core/models';
import { CertificacionService } from '../../../core/services/certificacion.service';
import { UnidadService } from '../../../core/services/unidad.service';
import { CuentaService } from '../../../core/services/cuenta.service';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModificacionService } from '../../../core/services/modificacion.service';
import { Combobox, ComboboxOption } from '../../../shared/components/combobox/combobox';
import { Datepicker } from '../../../shared/components/datepicker/datepicker';
import { MontoInput } from '../../../shared/components/monto-input/monto-input';

@Component({
  selector: 'app-form-certificacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Combobox, Datepicker, MontoInput],
  template: `
    <div class="card" style="max-width: 800px; margin: 0 auto">
      <div class="card-header">
        <h2>{{ isEditing() ? 'Editar' : 'Nueva' }} Certificación Presupuestaria</h2>
      </div>
      <div class="card-body">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <!-- Unidad Organizacional -->
          <div class="form-group">
            <label>Unidad Organizacional *</label>
            <app-combobox
              formControlName="id_unidad"
              [options]="unidadOptions()"
              placeholder="— Seleccionar unidad —"
              ariaLabel="Unidad organizacional"
            />
            @if (form.get('id_unidad')?.touched && form.get('id_unidad')?.hasError('required')) {
              <small class="form-error">La unidad organizacional es obligatoria.</small>
            }
          </div>

          <!-- Cuenta Contable -->
          <div class="form-group">
            <label>Cuenta Contable *</label>
            <app-combobox
              formControlName="id_cuenta_contable"
              [options]="cuentaOptions()"
              placeholder="— Seleccionar cuenta —"
              ariaLabel="Cuenta contable"
            />
            @if (form.get('id_cuenta_contable')?.touched && form.get('id_cuenta_contable')?.hasError('required')) {
              <small class="form-error">La cuenta contable es obligatoria.</small>
            }
          </div>

          <!-- Proyecto (Opcional) -->
          <div class="form-group">
            <label>Proyecto</label>
            <app-combobox
              formControlName="id_proyecto"
              [options]="proyectoOptions()"
              placeholder="— Sin proyecto —"
              ariaLabel="Proyecto"
            />
          </div>

          <!-- Concepto -->
          <div class="form-group">
            <label for="concepto">Concepto *</label>
            <textarea
              id="concepto"
              formControlName="concepto"
              rows="4"
              placeholder="Describa el concepto de la certificación presupuestaria..."
            ></textarea>
            @if (form.get('concepto')?.touched && form.get('concepto')?.hasError('required')) {
              <small class="form-error">El concepto es obligatorio.</small>
            }
          </div>

          <!-- Monto -->
          <div class="form-group">
            <label for="monto_total">Importe Total (Bs) *</label>
            <app-monto-input
              formControlName="monto_total"
            />
            @if (form.get('monto_total')?.touched && form.get('monto_total')?.hasError('required')) {
              <small class="form-error">El monto es obligatorio.</small>
            }
            @if (form.get('monto_total')?.touched && form.get('monto_total')?.hasError('min')) {
              <small class="form-error">El monto debe ser mayor a 0.</small>
            }
          </div>

          <!-- Fecha Certificación -->
          <div class="form-group">
            <label>Fecha de Certificación *</label>
            <app-datepicker
              formControlName="fecha_certificacion"
              placeholder="Seleccionar fecha"
              ariaLabel="Fecha de certificación"
            />
            @if (form.get('fecha_certificacion')?.touched && form.get('fecha_certificacion')?.hasError('required')) {
              <small class="form-error">La fecha es obligatoria.</small>
            }
          </div>

          <!-- Comentario -->
          <div class="form-group">
            <label for="comentario">Observaciones</label>
            <textarea
              id="comentario"
              formControlName="comentario"
              rows="2"
              placeholder="Comentario adicional (opcional)..."
            ></textarea>
          </div>

          <!-- Acciones -->
          <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem">
            <button type="button" class="btn btn-secondary" (click)="cancelar()">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="submitting() || form.invalid">
              @if (submitting()) {
                Guardando...
              } @else {
                {{ isEditing() ? 'Actualizar' : 'Crear' }} Certificación
              }
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: comentario de modificación -->
    @if (showModifModal()) {
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modif-modal-title">
        <div class="modal-box">
          <h3 id="modif-modal-title" class="modal-title">¿Desea agregar un comentario a esta modificación?</h3>
          <p class="modal-subtitle">El comentario quedará registrado en el historial de modificaciones de esta certificación. Es opcional.</p>
          <div class="form-group" style="margin-top: 1rem">
            <label for="modif-comentario">Comentario de modificación</label>
            <textarea
              id="modif-comentario"
              rows="3"
              [value]="modifComentario()"
              (input)="modifComentario.set($any($event.target).value)"
              placeholder="Describa brevemente el motivo de la modificación..."
            ></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="showModifModal.set(false)" [disabled]="submitting()">
              Cancelar
            </button>
            <button type="button" class="btn btn-outline" (click)="confirmarActualizar(null)" [disabled]="submitting()">
              Guardar sin comentario
            </button>
            <button type="button" class="btn btn-primary" (click)="confirmarActualizar(modifComentario())" [disabled]="submitting() || !modifComentario().trim()">
              @if (submitting()) { Guardando... } @else { Guardar con comentario }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .form-actions button {
      min-width: 140px;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-box {
      background: white;
      border-radius: 0.75rem;
      padding: 1.75rem;
      width: min(520px, 92vw);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-title {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0 0 0.35rem;
    }

    .modal-subtitle {
      font-size: 0.875rem;
      color: var(--color-ucb-gray-500);
      margin: 0;
    }

    .modal-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.25rem;
      flex-wrap: wrap;
    }

    .btn-outline {
      background: transparent;
      border: 1.5px solid var(--color-ucb-primary);
      color: var(--color-ucb-primary);
    }
  `,
})
export class FormCertificacion implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly certService = inject(CertificacionService);
  private readonly unidadService = inject(UnidadService);
  private readonly cuentaService = inject(CuentaService);
  private readonly proyectoService = inject(ProyectoService);
  private readonly toast = inject(ToastService);
  private readonly modifService = inject(ModificacionService);

  protected readonly isEditing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly showModifModal = signal(false);
  protected readonly modifComentario = signal('');
  protected readonly unidades = signal<UnidadConDependencia[]>([]);
  protected readonly cuentas = signal<CuentaContableDetalle[]>([]);
  protected readonly proyectos = signal<Proyecto[]>([]);

  protected readonly unidadOptions = computed<ComboboxOption[]>(() =>
    this.unidades().map(u => ({ value: u.id, label: `${u.codigo} — ${u.unidad} (${u.dependencia_nombre})` }))
  );

  protected readonly cuentaOptions = computed<ComboboxOption[]>(() =>
    this.cuentas().map(c => ({ value: c.id, label: `${c.codigo} — ${c.cuenta}` }))
  );

  protected readonly proyectoOptions = computed<ComboboxOption[]>(() =>
    this.proyectos().map(p => ({ value: p.id, label: p.nombre + (p.pei ? ` (PEI: ${p.pei})` : '') }))
  );

  private certId = '';
  private certOriginal: CertificacionDetalle | null = null;

  protected readonly form = this.fb.nonNullable.group({
    id_unidad: ['', Validators.required],
    id_cuenta_contable: ['', Validators.required],
    id_proyecto: [''],
    concepto: ['', Validators.required],
    monto_total: [0, [Validators.required, Validators.min(0.01)]],
    fecha_certificacion: ['', Validators.required],
    comentario: [''],
  });

  async ngOnInit(): Promise<void> {
    // Load catalogs in parallel
    try {
      const [unidades, cuentas, proyectos] = await Promise.all([
        this.unidadService.listarUnidades(),
        this.cuentaService.listar(),
        this.proyectoService.listar(),
      ]);
      this.unidades.set(unidades.filter((u) => u.activo));
      this.cuentas.set(cuentas.filter((c) => c.activo && c.nivel === 5));
      this.proyectos.set(proyectos.filter((p) => p.activo));
    } catch {
      this.toast.error('Error al cargar catálogos');
    }

    // Check if editing
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditing.set(true);
      this.certId = id;
      try {
        const cert = await this.certService.obtener(id);
        this.certOriginal = cert;
        this.form.patchValue({
          id_unidad: cert.generado_por_id ? this.findUnidadId(cert) : '',
          id_cuenta_contable: this.findCuentaId(cert),
          id_proyecto: this.findProyectoId(cert),
          concepto: cert.concepto,
          monto_total: parseFloat(cert.monto_total),
          fecha_certificacion: cert.fecha_certificacion.split('T')[0],
          comentario: cert.comentario ?? '',
        });
      } catch {
        this.toast.error('Error al cargar certificación');
        this.router.navigate(['/dashboard']);
      }
    } else {
      // Default date = today
      const today = new Date().toISOString().split('T')[0];
      this.form.patchValue({ fecha_certificacion: today });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    if (this.isEditing()) {
      // Show confirmation modal to optionally add a modification comment
      this.modifComentario.set('');
      this.showModifModal.set(true);
      return;
    }

    // Create mode — save directly
    this.submitting.set(true);
    const val = this.form.getRawValue();
    try {
      await this.certService.crear({
        id_unidad: val.id_unidad,
        id_cuenta_contable: val.id_cuenta_contable,
        id_proyecto: val.id_proyecto || null,
        concepto: val.concepto,
        monto_total: val.monto_total.toFixed(2),
        comentario: val.comentario || null,
      });
      this.toast.success('Certificación creada correctamente');
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async confirmarActualizar(comentario: string | null): Promise<void> {
    this.submitting.set(true);
    const val = this.form.getRawValue();
    try {
      await this.certService.editar(this.certId, {
        id_unidad: val.id_unidad,
        id_cuenta_contable: val.id_cuenta_contable,
        id_proyecto: val.id_proyecto || null,
        concepto: val.concepto,
        monto_total: val.monto_total.toFixed(2),
        comentario: val.comentario || null,
      });

      // Register modification record
      const orig = this.certOriginal;
      await this.modifService.crear({
        id_certificacion: this.certId,
        monto_antiguo: orig ? orig.monto_total : null,
        monto_nuevo: val.monto_total.toFixed(2),
        concepto_antiguo: orig ? orig.concepto : null,
        concepto_nuevo: val.concepto,
        comentario: comentario?.trim() || null,
      });

      this.toast.success('Certificación actualizada correctamente');
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.submitting.set(false);
      this.showModifModal.set(false);
    }
  }

  protected cancelar(): void {
    this.router.navigate(['/dashboard']);
  }

  // We need to find IDs from the loaded catalogs based on cert detail data
  private findUnidadId(cert: CertificacionDetalle): string {
    const found = this.unidades().find(
      (u) => u.codigo === cert.unidad_codigo && u.unidad === cert.unidad_nombre,
    );
    return found?.id ?? '';
  }

  private findCuentaId(cert: CertificacionDetalle): string {
    const found = this.cuentas().find(
      (c) => c.codigo === cert.cuenta_codigo && c.cuenta === cert.cuenta_nombre,
    );
    return found?.id ?? '';
  }

  private findProyectoId(cert: CertificacionDetalle): string {
    if (!cert.proyecto_nombre) return '';
    const found = this.proyectos().find((p) => p.nombre === cert.proyecto_nombre);
    return found?.id ?? '';
  }
}
