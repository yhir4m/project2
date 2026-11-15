// Generado desde Supabase (proyecto dytxbichhnnopmqoyzgf). No editar a mano:
// regenerar con `supabase gen types typescript --project-id dytxbichhnnopmqoyzgf`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      comercio_convenios: {
        Row: { comercio_id: string; convenio_id: string };
        Insert: { comercio_id: string; convenio_id: string };
        Update: { comercio_id?: string; convenio_id?: string };
        Relationships: [
          { foreignKeyName: "comercio_convenios_comercio_id_fkey"; columns: ["comercio_id"]; isOneToOne: false; referencedRelation: "comercios"; referencedColumns: ["id"] },
          { foreignKeyName: "comercio_convenios_convenio_id_fkey"; columns: ["convenio_id"]; isOneToOne: false; referencedRelation: "convenios"; referencedColumns: ["id"] },
        ];
      };
      comercios: {
        Row: {
          activo: boolean;
          created_at: string;
          direccion: string | null;
          giro: string | null;
          id: string;
          lat: number | null;
          lng: number | null;
          nombre: string;
          pey_bank_account_id: string | null;
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          direccion?: string | null;
          giro?: string | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          nombre: string;
          pey_bank_account_id?: string | null;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          direccion?: string | null;
          giro?: string | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          nombre?: string;
          pey_bank_account_id?: string | null;
        };
        Relationships: [];
      };
      convenios: {
        Row: {
          activo: boolean;
          created_at: string;
          descripcion: string | null;
          emisor_id: string;
          id: string;
          nombre: string;
          regla: Json;
          tipo_beneficiario: string;
          updated_at: string;
          vigente_desde: string;
          vigente_hasta: string | null;
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          descripcion?: string | null;
          emisor_id: string;
          id?: string;
          nombre: string;
          regla: Json;
          tipo_beneficiario: string;
          updated_at?: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          descripcion?: string | null;
          emisor_id?: string;
          id?: string;
          nombre?: string;
          regla?: Json;
          tipo_beneficiario?: string;
          updated_at?: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
        };
        Relationships: [
          { foreignKeyName: "convenios_emisor_id_fkey"; columns: ["emisor_id"]; isOneToOne: false; referencedRelation: "emisores"; referencedColumns: ["id"] },
        ];
      };
      credenciales: {
        Row: {
          created_at: string;
          dispositivo_hash: string | null;
          emisor_id: string;
          estado: Database["public"]["Enums"]["estado_credencial"];
          id: string;
          jws: string | null;
          motivo_revocacion: string | null;
          revocada_at: string | null;
          seudonimo: string;
          tipo_beneficiario: string;
          usuario_id: string;
          verificacion_id: string | null;
          vigente_desde: string;
          vigente_hasta: string;
        };
        Insert: {
          created_at?: string;
          dispositivo_hash?: string | null;
          emisor_id: string;
          estado?: Database["public"]["Enums"]["estado_credencial"];
          id?: string;
          jws?: string | null;
          motivo_revocacion?: string | null;
          revocada_at?: string | null;
          seudonimo?: string;
          tipo_beneficiario: string;
          usuario_id: string;
          verificacion_id?: string | null;
          vigente_desde?: string;
          vigente_hasta: string;
        };
        Update: {
          created_at?: string;
          dispositivo_hash?: string | null;
          emisor_id?: string;
          estado?: Database["public"]["Enums"]["estado_credencial"];
          id?: string;
          jws?: string | null;
          motivo_revocacion?: string | null;
          revocada_at?: string | null;
          seudonimo?: string;
          tipo_beneficiario?: string;
          usuario_id?: string;
          verificacion_id?: string | null;
          vigente_desde?: string;
          vigente_hasta?: string;
        };
        Relationships: [
          { foreignKeyName: "credenciales_emisor_id_fkey"; columns: ["emisor_id"]; isOneToOne: false; referencedRelation: "emisores"; referencedColumns: ["id"] },
          { foreignKeyName: "credenciales_verificacion_id_fkey"; columns: ["verificacion_id"]; isOneToOne: false; referencedRelation: "verificaciones"; referencedColumns: ["id"] },
        ];
      };
      emisores: {
        Row: {
          activo: boolean;
          created_at: string;
          dominios_correo: string[];
          id: string;
          llave_publica: string | null;
          nombre: string;
          nombre_corto: string;
          palabras_institucion: string[];
          tipo_periodo: Database["public"]["Enums"]["tipo_periodo"];
          tipos_beneficiario: string[];
          tipos_documento: string[];
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          dominios_correo?: string[];
          id: string;
          llave_publica?: string | null;
          nombre: string;
          nombre_corto: string;
          palabras_institucion?: string[];
          tipo_periodo?: Database["public"]["Enums"]["tipo_periodo"];
          tipos_beneficiario?: string[];
          tipos_documento?: string[];
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          dominios_correo?: string[];
          id?: string;
          llave_publica?: string | null;
          nombre?: string;
          nombre_corto?: string;
          palabras_institucion?: string[];
          tipo_periodo?: Database["public"]["Enums"]["tipo_periodo"];
          tipos_beneficiario?: string[];
          tipos_documento?: string[];
        };
        Relationships: [];
      };
      nonces_usados: {
        Row: { expira_en: string; nonce: string; usado_en: string };
        Insert: { expira_en: string; nonce: string; usado_en?: string };
        Update: { expira_en?: string; nonce?: string; usado_en?: string };
        Relationships: [];
      };
      notificaciones: {
        Row: {
          created_at: string;
          cuerpo: string | null;
          datos: Json;
          id: string;
          leida: boolean;
          tipo: string;
          titulo: string;
          usuario_id: string;
        };
        Insert: {
          created_at?: string;
          cuerpo?: string | null;
          datos?: Json;
          id?: string;
          leida?: boolean;
          tipo: string;
          titulo: string;
          usuario_id: string;
        };
        Update: {
          created_at?: string;
          cuerpo?: string | null;
          datos?: Json;
          id?: string;
          leida?: boolean;
          tipo?: string;
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          celular: string | null;
          comercio_id: string | null;
          consentimiento_at: string | null;
          created_at: string;
          emisor_id: string | null;
          id: string;
          letra_grande: boolean;
          nombre: string | null;
          rol: Database["public"]["Enums"]["rol_usuario"];
          updated_at: string;
        };
        Insert: {
          celular?: string | null;
          comercio_id?: string | null;
          consentimiento_at?: string | null;
          created_at?: string;
          emisor_id?: string | null;
          id: string;
          letra_grande?: boolean;
          nombre?: string | null;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          updated_at?: string;
        };
        Update: {
          celular?: string | null;
          comercio_id?: string | null;
          consentimiento_at?: string | null;
          created_at?: string;
          emisor_id?: string | null;
          id?: string;
          letra_grande?: boolean;
          nombre?: string | null;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "perfiles_comercio_id_fkey"; columns: ["comercio_id"]; isOneToOne: false; referencedRelation: "comercios"; referencedColumns: ["id"] },
          { foreignKeyName: "perfiles_emisor_id_fkey"; columns: ["emisor_id"]; isOneToOne: false; referencedRelation: "emisores"; referencedColumns: ["id"] },
        ];
      };
      productos: {
        Row: { activo: boolean; comercio_id: string; id: string; nombre: string; precio_centavos: number; sku: string };
        Insert: { activo?: boolean; comercio_id: string; id?: string; nombre: string; precio_centavos: number; sku: string };
        Update: { activo?: boolean; comercio_id?: string; id?: string; nombre?: string; precio_centavos?: number; sku?: string };
        Relationships: [
          { foreignKeyName: "productos_comercio_id_fkey"; columns: ["comercio_id"]; isOneToOne: false; referencedRelation: "comercios"; referencedColumns: ["id"] },
        ];
      };
      rate_limits: {
        Row: { clave: string; conteo: number; ventana: string };
        Insert: { clave: string; conteo?: number; ventana: string };
        Update: { clave?: string; conteo?: number; ventana?: string };
        Relationships: [];
      };
      transacciones: {
        Row: {
          canal: Database["public"]["Enums"]["canal_codi"] | null;
          comercio_id: string;
          compra: Json;
          convenio_id: string;
          created_at: string;
          credencial_id: string;
          descuento_centavos: number;
          error: string | null;
          estado: Database["public"]["Enums"]["estado_transaccion"];
          expira_en: string | null;
          id: string;
          idempotency_key: string;
          metodo: Database["public"]["Enums"]["metodo_pago"];
          modo_prueba: boolean;
          monto_cobrado_centavos: number;
          monto_final_centavos: number;
          pagada_en: string | null;
          pey_codi_id: string | null;
          pey_id: string | null;
          pey_num_ref: string | null;
          pey_qr_string: string | null;
          precio_original_centavos: number;
          updated_at: string;
        };
        Insert: {
          canal?: Database["public"]["Enums"]["canal_codi"] | null;
          comercio_id: string;
          compra: Json;
          convenio_id: string;
          created_at?: string;
          credencial_id: string;
          descuento_centavos: number;
          error?: string | null;
          estado?: Database["public"]["Enums"]["estado_transaccion"];
          expira_en?: string | null;
          id?: string;
          idempotency_key: string;
          metodo: Database["public"]["Enums"]["metodo_pago"];
          modo_prueba: boolean;
          monto_cobrado_centavos: number;
          monto_final_centavos: number;
          pagada_en?: string | null;
          pey_codi_id?: string | null;
          pey_id?: string | null;
          pey_num_ref?: string | null;
          pey_qr_string?: string | null;
          precio_original_centavos: number;
          updated_at?: string;
        };
        Update: {
          canal?: Database["public"]["Enums"]["canal_codi"] | null;
          comercio_id?: string;
          compra?: Json;
          convenio_id?: string;
          created_at?: string;
          credencial_id?: string;
          descuento_centavos?: number;
          error?: string | null;
          estado?: Database["public"]["Enums"]["estado_transaccion"];
          expira_en?: string | null;
          id?: string;
          idempotency_key?: string;
          metodo?: Database["public"]["Enums"]["metodo_pago"];
          modo_prueba?: boolean;
          monto_cobrado_centavos?: number;
          monto_final_centavos?: number;
          pagada_en?: string | null;
          pey_codi_id?: string | null;
          pey_id?: string | null;
          pey_num_ref?: string | null;
          pey_qr_string?: string | null;
          precio_original_centavos?: number;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "transacciones_comercio_id_fkey"; columns: ["comercio_id"]; isOneToOne: false; referencedRelation: "comercios"; referencedColumns: ["id"] },
          { foreignKeyName: "transacciones_convenio_id_fkey"; columns: ["convenio_id"]; isOneToOne: false; referencedRelation: "convenios"; referencedColumns: ["id"] },
          { foreignKeyName: "transacciones_credencial_id_fkey"; columns: ["credencial_id"]; isOneToOne: false; referencedRelation: "credenciales"; referencedColumns: ["id"] },
        ];
      };
      verificaciones: {
        Row: {
          confianza: number | null;
          created_at: string;
          documento_path: string | null;
          emisor_id: string;
          estado: Database["public"]["Enums"]["estado_verificacion"];
          id: string;
          metodo: Database["public"]["Enums"]["metodo_verificacion"];
          motivos: string[];
          nombre_declarado: string | null;
          revisado_at: string | null;
          revisado_por: string | null;
          tipo_beneficiario: string;
          updated_at: string;
          usuario_id: string;
        };
        Insert: {
          confianza?: number | null;
          created_at?: string;
          documento_path?: string | null;
          emisor_id: string;
          estado?: Database["public"]["Enums"]["estado_verificacion"];
          id?: string;
          metodo: Database["public"]["Enums"]["metodo_verificacion"];
          motivos?: string[];
          nombre_declarado?: string | null;
          revisado_at?: string | null;
          revisado_por?: string | null;
          tipo_beneficiario: string;
          updated_at?: string;
          usuario_id: string;
        };
        Update: {
          confianza?: number | null;
          created_at?: string;
          documento_path?: string | null;
          emisor_id?: string;
          estado?: Database["public"]["Enums"]["estado_verificacion"];
          id?: string;
          metodo?: Database["public"]["Enums"]["metodo_verificacion"];
          motivos?: string[];
          nombre_declarado?: string | null;
          revisado_at?: string | null;
          revisado_por?: string | null;
          tipo_beneficiario?: string;
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [
          { foreignKeyName: "verificaciones_emisor_id_fkey"; columns: ["emisor_id"]; isOneToOne: false; referencedRelation: "emisores"; referencedColumns: ["id"] },
        ];
      };
      webhook_eventos: {
        Row: {
          error: string | null;
          id: string;
          payload: Json;
          procesado: boolean;
          procesado_at: string | null;
          recibido_at: string;
          tipo: string;
          transaccion_id: string | null;
        };
        Insert: {
          error?: string | null;
          id: string;
          payload: Json;
          procesado?: boolean;
          procesado_at?: string | null;
          recibido_at?: string;
          tipo: string;
          transaccion_id?: string | null;
        };
        Update: {
          error?: string | null;
          id?: string;
          payload?: Json;
          procesado?: boolean;
          procesado_at?: string | null;
          recibido_at?: string;
          tipo?: string;
          transaccion_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "webhook_eventos_transaccion_id_fkey"; columns: ["transaccion_id"]; isOneToOne: false; referencedRelation: "transacciones"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      buscar_convenio: {
        Args: { p_comercio_id: string; p_emisor_id: string; p_tipo: string };
        Returns: { id: string; nombre: string; regla: Json }[];
      };
      consumir_nonce: { Args: { p_expira_en: string; p_nonce: string }; Returns: boolean };
      mantenimiento: { Args: never; Returns: undefined };
      mi_comercio_id: { Args: never; Returns: string };
      mi_emisor_id: { Args: never; Returns: string };
      mi_rol: { Args: never; Returns: Database["public"]["Enums"]["rol_usuario"] };
      reporte_emisor: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          codi: number;
          convenio: string;
          convenio_id: string;
          descuento_centavos: number;
          dia: string;
          efectivo: number;
          usos: number;
          venta_centavos: number;
        }[];
      };
      resumen_credenciales_emisor: {
        Args: never;
        Returns: { estado: Database["public"]["Enums"]["estado_credencial"]; tipo_beneficiario: string; total: number }[];
      };
      rl_consumir: { Args: { p_clave: string; p_limite: number; p_ventana_seg: number }; Returns: boolean };
      usos_hoy: { Args: { p_convenio_id: string; p_credencial_id: string }; Returns: number };
    };
    Enums: {
      canal_codi: "pn" | "qr";
      estado_credencial: "activa" | "revocada" | "vencida";
      estado_transaccion: "creando" | "pendiente" | "incierta" | "pagada" | "expirada" | "cancelada" | "fallida";
      estado_verificacion: "pendiente" | "aprobada" | "rechazada" | "revision_manual";
      metodo_pago: "codi" | "efectivo";
      metodo_verificacion: "correo_institucional" | "documento_ia" | "externo";
      rol_usuario: "beneficiario" | "comercio" | "emisor";
      tipo_periodo: "cuatrimestre" | "semestre" | "anual";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
