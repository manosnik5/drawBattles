package com.drawroyale.configurations;

import com.corundumstudio.socketio.AuthorizationListener;
import com.corundumstudio.socketio.AuthorizationResult;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

@org.springframework.context.annotation.Configuration
public class SocketIOConfig {

    @Value("${socketio.port}")
    private int socketioPort;

    @Value("${client.origin}")
    private String clientOrigin;

    private SocketIOServer server;

    @Bean
    public SocketIOServer socketIOServer() {
        Configuration config = new Configuration();
        config.setPort(socketioPort);
        config.setOrigin(clientOrigin);

        // Allow all connections 
        config.setAuthorizationListener(data -> AuthorizationResult.SUCCESSFUL_AUTHORIZATION);

        server = new SocketIOServer(config);
        server.start();

        return server;
    }

    @PreDestroy
    public void stopServer() {
        if (server != null) {
            server.stop();
        }
    }
}