{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import React from 'react'\
\
export default function ForecastView() \{\
  return (\
    <div>\
      <div className="flex items-center justify-between mb-6">\
        <h1 className="text-xl font-semibold text-gray-900">Forecast</h1>\
        <span className="text-xs px-3 py-1.5 rounded-full font-medium"\
          style=\{\{ background: '#E0FDF8', color: '#0D9488' \}\}>\
          In sviluppo\
        </span>\
      </div>\
\
      <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">\
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"\
          style=\{\{ background: '#E0FDF8' \}\}>\
          <span className="text-3xl">\uc0\u9678 </span>\
        </div>\
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Vista Forecast</h2>\
        <p className="text-sm text-gray-500 max-w-md leading-relaxed">\
          Qui vedremo la capacit\'e0 futura del team incrociata con i progetti attivi,\
          i rinnovi previsti e i prospect in pipeline. Una vista unica per rispondere\
          alla domanda: <strong>c'\'e8 spazio per nuove attivit\'e0 e quando?</strong>\
        </p>\
        <div className="mt-6 flex gap-3 flex-wrap justify-center">\
          \{['Progetti attivi', 'Rinnovi H2', 'Prospect in pipeline', 'Capacit\'e0 disponibile'].map(label => (\
            <span key=\{label\} className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500">\
              \{label\}\
            </span>\
          ))\}\
        </div>\
      </div>\
    </div>\
  )\
\}}