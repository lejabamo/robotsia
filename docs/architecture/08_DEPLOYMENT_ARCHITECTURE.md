# 08 - Arquitectura de Despliegue (Deployment Architecture)

Distribución física de los contenedores e interacciones de red.

```mermaid
flowchart TD
    subgraph Exterior
        USR[Usuario Funcional]
        IMAP_SVR[Servidor IMAP O365/Corp]
        SECOP[SECOP II Portal Gov]
    end

    subgraph Host_Docker [Host Anfitrión / Servidor]
        subgraph Red_Docker [Red Interna: sia_network]
            API[Contenedor API & Dashboard (Express)]
            WORKER[Contenedor Worker (Node.js + Playwright)]
            REDIS[(Contenedor Redis)]
            
            VOL_DOWNLOADS[((Volumen: /app/downloads))]
            VOL_CERTS[((Volumen: /app/certificates))]
        end
    end

    %% Conexiones
    USR -->|HTTP/HTTPS| API
    IMAP_SVR -->|IMAP-TLS| WORKER
    WORKER -->|HTTPS Scraping| SECOP
    
    API <-->|Colas BullMQ| REDIS
    WORKER <-->|Consumo BullMQ| REDIS
    
    WORKER -.->|I/O Evidencias| VOL_DOWNLOADS
    WORKER -.->|I/O Word/Excel| VOL_CERTS
    API -.->|Lectura para UI| VOL_CERTS
```

### Justificación Física
1.  **Aislamiento de Playwright:** El motor robótico pesa drásticamente en memoria RAM. Desplegarlo en un `WORKER` segregado permite escalar horizontalmente los nodos de navegación sin derribar la API del Dashboard.
2.  **Redis Centralizado:** Actúa como la espina dorsal asíncrona, desvinculando la recepción de correo (alta velocidad) de la descarga de documentos (baja velocidad).
3.  **Volúmenes Compartidos:** Asegura que los archivos generados por los Workers sean accesibles y descargables mediante la API web, sobreviviendo al reinicio de los contenedores efímeros.
