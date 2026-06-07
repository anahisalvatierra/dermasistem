import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, NgFor],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing {

  constructor(private router: Router) {}

  skinMetrics = [
    { label: 'Hidratación',      value: 85 },
    { label: 'Luminosidad',      value: 72 },
    { label: 'Protección solar', value: 60 }
  ];

  skinChips = ['Piel mixta', 'Sensible', 'Zona T activa'];

  features = [
    { icon: '🔬', title: 'Escaneo Facial con IA',   desc: 'Analiza tu tipo de piel desde la cámara de tu dispositivo. La inteligencia artificial identifica tu dermis y crea un perfil personalizado.' },
    { icon: '🌿', title: 'Catálogo Personalizado',  desc: 'Más de 12 productos premium filtrados por categoría, tipo de piel y valoración. Encuentra exactamente lo que necesitas.' },
    { icon: '🛍️', title: 'Carrito Inteligente',     desc: 'Gestiona tus compras con un sistema de carrito completo. Agrega, ajusta cantidades y confirma tu pedido en segundos.' },
    { icon: '🔐', title: 'Cuenta Segura',           desc: 'Autenticación segura con Supabase. Registro, inicio de sesión y recuperación de contraseña con tokens JWT cifrados.' },
    { icon: '❤️', title: 'Lista de Favoritos',      desc: 'Guarda los productos que más te gustan para acceder a ellos rápidamente. Tu lista favorita siempre disponible.' },
    { icon: '✦',  title: 'Recomendaciones',         desc: 'Recibe sugerencias personalizadas basadas en tu tipo de piel, historial y los productos mejor valorados por la comunidad.' }
  ];

  productos = [
    { bg: '#D4EDE8', emoji: '🫧', brand: 'CeraVe',         name: 'Gel Limpiador Suave',    price: '$24.99' },
    { bg: '#FFF0C8', emoji: '🧪', brand: 'The Ordinary',   name: 'Sérum Vitamina C',       price: '$49.99' },
    { bg: '#FFF3C8', emoji: '☀️', brand: 'La Roche-Posay', name: 'Protector Solar SPF 50', price: '$29.99' },
    { bg: '#F9E4D4', emoji: '🌹', brand: 'Glow Recipe',    name: 'Crema Hidratante Rosa',  price: '$34.99' }
  ];

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

}