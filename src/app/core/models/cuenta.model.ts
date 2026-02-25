export interface TipoCuenta {
  id: string;
  tipo: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrearTipoCuenta {
  tipo: string;
}

export interface EditarTipoCuenta {
  tipo?: string;
  activo?: boolean;
}

export interface CuentaContable {
  id: string;
  id_tipo_cuenta: string;
  id_cuenta_padre: string | null;
  codigo: string;
  cuenta: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CuentaContableDetalle {
  id: string;
  id_tipo_cuenta: string;
  id_cuenta_padre: string | null;
  codigo: string;
  cuenta: string;
  activo: boolean;
  tipo_cuenta_nombre: string;
  cuenta_padre_codigo: string | null;
  cuenta_padre_nombre: string | null;
}

export interface CrearCuenta {
  id_tipo_cuenta: string;
  id_cuenta_padre?: string | null;
  codigo: string;
  cuenta: string;
}

export interface EditarCuenta {
  id_tipo_cuenta?: string;
  id_cuenta_padre?: string | null;
  codigo?: string;
  cuenta?: string;
  activo?: boolean;
}
