export interface Alert {
  id: number;
  user_id: number;
  tipo_incidencia: string;
  descripcion: string;
  latitud: number;
  longitud: number;
  fecha_ingreso: string;
  fecha_suceso: string;
  evidencia_url?: string;
  usuario_nombre?: string;
  usuario_dni?: string;
  estado: string;
}
