package com.drawroyale.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController {

    @RequestMapping(value = {
        "/",
        "/room/**",
        "/friends/**",
        "/auth-callback"
    })
    public String spa() {
        return "forward:/index.html";
    }
}