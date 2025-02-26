'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import Image from 'next/image'

type Testimonial = {
  quote: string
  author: string
  role: string
  company: string
  avatar: string
}

const testimonials: Testimonial[] = [
  {
    quote: "VS Code Sync has completely transformed my workflow. I can now switch between my work and personal laptops seamlessly, with all my extensions and settings intact.",
    author: "Sarah Johnson",
    role: "Senior Developer",
    company: "TechCorp",
    avatar: "/avatars/avatar-1.png"
  },
  {
    quote: "The ability to download a complete VS Code package with all my settings is a game-changer. Setting up a new machine used to take hours, now it takes minutes.",
    author: "Michael Chen",
    role: "Full Stack Engineer",
    company: "DevStream",
    avatar: "/avatars/avatar-2.png"
  },
  {
    quote: "I work across multiple machines and OS platforms. VS Code Sync ensures my development environment is consistent everywhere. It's an essential tool for any serious developer.",
    author: "Emma Rodriguez",
    role: "DevOps Specialist",
    company: "CloudNine",
    avatar: "/avatars/avatar-3.png"
  }
]

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-blue-100 px-3 py-1 text-sm dark:bg-blue-800/30">
              Testimonials
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">What Our Users Say</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              Hear from developers who have transformed their workflow with VS Code Sync.
            </p>
          </div>
        </div>
        
        <div className="mx-auto max-w-4xl mt-12">
          <div className="relative overflow-hidden rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
            <Quote className="absolute top-4 left-4 h-12 w-12 text-blue-100 dark:text-blue-900/20" />
            
            <div className="relative z-10">
              <blockquote className="mb-8 text-lg italic text-gray-700 dark:text-gray-300">
                "{testimonials[currentIndex].quote}"
              </blockquote>
              
              <div className="flex items-center">
                <div className="relative h-12 w-12 overflow-hidden rounded-full">
                  <div className="bg-gray-200 h-full w-full flex items-center justify-center dark:bg-gray-700">
                    <span className="text-xl font-bold text-gray-500 dark:text-gray-400">
                      {testimonials[currentIndex].author.charAt(0)}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="font-medium">{testimonials[currentIndex].author}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {testimonials[currentIndex].role}, {testimonials[currentIndex].company}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-center space-x-4">
            <button
              onClick={prevTestimonial}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 w-2 rounded-full ${
                    index === currentIndex
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={nextTestimonial}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
} 